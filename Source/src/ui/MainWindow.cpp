#include "ui/MainWindow.h"

#include "core/MarkdownExporter.h"
#include "ui/SettingsDialog.h"
#include "ui/TemplateDialog.h"
#include "ui/UiTheme.h"
#include "ui/SafeMarkdownBrowser.h"

#include <QAction>
#include <QApplication>
#include <QClipboard>
#include <QDateTime>
#include <QDialog>
#include <QDialogButtonBox>
#include <QFile>
#include <QFileDialog>
#include <QFrame>
#include <QFormLayout>
#include <QHBoxLayout>
#include <QCheckBox>
#include <QInputDialog>
#include <QIODevice>
#include <QLocale>
#include <QMenu>
#include <QMenuBar>
#include <QMessageBox>
#include <QSplitter>
#include <QStatusBar>
#include <QTabWidget>
#include <QTextDocument>
#include <QTextCursor>
#include <QTextEdit>
#include <QToolButton>
#include <QVBoxLayout>
#include <utility>

namespace {
QString relationStartMarker(qint64 targetNodeId)
{
    return QStringLiteral("<!-- memgraph-relation:%1 -->").arg(targetNodeId);
}

QString relationEndMarker(qint64 targetNodeId)
{
    return QStringLiteral("<!-- /memgraph-relation:%1 -->").arg(targetNodeId);
}

QString extractRelationSection(const QString &markdown, qint64 targetNodeId)
{
    const QString start = relationStartMarker(targetNodeId);
    const QString end = relationEndMarker(targetNodeId);
    const qsizetype startIndex = markdown.indexOf(start);
    if (startIndex < 0) {
        return {};
    }
    const qsizetype contentStart = startIndex + start.size();
    const qsizetype endIndex = markdown.indexOf(end, contentStart);
    if (endIndex < 0) {
        return {};
    }

    QString content = markdown.mid(contentStart, endIndex - contentStart).trimmed();
    const qsizetype headingEnd = content.indexOf(QStringLiteral("\n"));
    if (content.startsWith(QStringLiteral("#")) && headingEnd >= 0) {
        content = content.mid(headingEnd + 1).trimmed();
    }
    return content;
}

QString upsertRelationSection(const QString &markdown, qint64 targetNodeId, const QString &heading, const QString &relation)
{
    const QString start = relationStartMarker(targetNodeId);
    const QString end = relationEndMarker(targetNodeId);
    const QString section = QStringLiteral("%1\n\n%2\n\n%3\n\n%4")
        .arg(start, heading, relation.trimmed(), end);

    QString updated = markdown.trimmed();
    const qsizetype startIndex = updated.indexOf(start);
    if (startIndex >= 0) {
        const qsizetype endIndex = updated.indexOf(end, startIndex + start.size());
        if (endIndex >= 0) {
            updated.replace(startIndex, endIndex + end.size() - startIndex, section);
            return updated.trimmed();
        }
    }

    if (!updated.isEmpty()) {
        updated += QStringLiteral("\n\n");
    }
    updated += section;
    return updated.trimmed();
}

QString versionUpdatedAt()
{
    const QString buildText = QStringLiteral(__DATE__ " " __TIME__).simplified();
    const QDateTime buildTime = QLocale::c().toDateTime(buildText, QStringLiteral("MMM d yyyy HH:mm:ss"));
    return buildTime.isValid() ? buildTime.toString(QStringLiteral("yyyy-MM-dd HH:mm:ss")) : buildText;
}
}

MainWindow::MainWindow(GraphStore *store, AppSettings *settings, SecretStore *secretStore, QWidget *parent)
    : QMainWindow(parent)
    , store_(store)
    , settings_(settings)
    , secretStore_(secretStore)
    , aiClient_(this)
{
    setupUi();
    reloadTemplates();
    reloadMaps();

    connect(&aiClient_, &AiClient::generationFinished, this, [this](qint64 nodeId, const QString &markdown) {
        if (pendingRelationGenerations_.contains(nodeId)) {
            const PendingRelationGeneration pending = pendingRelationGenerations_.take(nodeId);
            QString error;
            const NodeRecord source = store_->node(pending.sourceNodeId, &error);
            if (source.id == 0) {
                QMessageBox::warning(this, tr("Update Relation"), error);
                return;
            }
            const NodeRecord target = store_->node(pending.targetNodeId, &error);
            if (target.id == 0) {
                QMessageBox::warning(this, tr("Update Relation"), error);
                return;
            }

            const QString heading = tr("## Relationship to %1").arg(target.title);
            const QString updatedMarkdown = upsertRelationSection(source.markdown, target.id, heading, markdown);
            if (!store_->updateNodeContent(source.id, source.title, updatedMarkdown, &error)) {
                QMessageBox::warning(this, tr("Update Relation"), error);
                return;
            }
            store_->updateEdgeLabel(pending.edgeId, QString(), &error);
            loadMap(currentMapId_);
            canvas_->selectNode(pending.sourceNodeId);
            statusLabel_->setText(pending.createdEdge ? tr("Relation created.") : tr("Relation updated."));
            return;
        }

        if (!pendingGenerations_.contains(nodeId)) {
            return;
        }
        store_->updateNodeMarkdown(nodeId, markdown, QStringLiteral("ready"));
        const PendingGeneration pending = pendingGenerations_.take(nodeId);
        store_->recordGeneration(nodeId, pending.model, pending.apiMode, pending.promptSnapshot, QStringLiteral("success"));
        loadMap(currentMapId_);
        canvas_->selectNode(nodeId);
        statusLabel_->setText(tr("Generation completed."));
    });

    connect(&aiClient_, &AiClient::generationFailed, this, [this](qint64 nodeId, const QString &errorMessage) {
        if (pendingRelationGenerations_.contains(nodeId)) {
            const PendingRelationGeneration pending = pendingRelationGenerations_.take(nodeId);
            loadMap(currentMapId_);
            canvas_->selectNode(pending.sourceNodeId);
            statusLabel_->setText(tr("Relation generation failed."));
            QMessageBox::warning(this, tr("Update Relation"), errorMessage);
            return;
        }

        if (!pendingGenerations_.contains(nodeId)) {
            return;
        }
        const QString markdown = tr("Generation failed:\n\n%1").arg(errorMessage);
        store_->updateNodeMarkdown(nodeId, markdown, QStringLiteral("error"));
        const PendingGeneration pending = pendingGenerations_.take(nodeId);
        store_->recordGeneration(nodeId, pending.model, pending.apiMode, pending.promptSnapshot, QStringLiteral("error"), errorMessage);
        loadMap(currentMapId_);
        canvas_->selectNode(nodeId);
        statusLabel_->setText(tr("Generation failed."));
    });
}

void MainWindow::setupUi()
{
    setWindowTitle(tr("MemGraph"));
    resize(1280, 780);
    setMinimumSize(880, 600);

    auto *fileMenu = menuBar()->addMenu(tr("File"));
    auto *newMapAction = fileMenu->addAction(
        UiTheme::icon(QStringLiteral("document-new"), QStyle::SP_FileDialogNewFolder),
        tr("New Map"), this, &MainWindow::createMap);
    newMapAction->setShortcut(QKeySequence::New);
    renameMapAction_ = new QAction(
        UiTheme::icon(QStringLiteral("edit-rename"), QStyle::SP_FileDialogDetailedView), tr("Rename Map"), this);
    deleteMapAction_ = new QAction(
        UiTheme::icon(QStringLiteral("edit-delete"), QStyle::SP_TrashIcon), tr("Delete Map"), this);
    exportMapAction_ = new QAction(
        UiTheme::icon(QStringLiteral("document-save-as"), QStyle::SP_DialogSaveButton),
        tr("Export Map Markdown"), this);
    connect(renameMapAction_, &QAction::triggered, this, &MainWindow::renameCurrentMap);
    connect(deleteMapAction_, &QAction::triggered, this, &MainWindow::deleteCurrentMap);
    connect(exportMapAction_, &QAction::triggered, this, &MainWindow::exportMapMarkdown);

    fileMenu->addSeparator();
    fileMenu->addAction(UiTheme::icon(QStringLiteral("user-trash"), QStyle::SP_TrashIcon),
                        tr("Recycle Bin"), this, &MainWindow::openTrash);
    fileMenu->addSeparator();
    auto *quitAction = fileMenu->addAction(
        UiTheme::icon(QStringLiteral("application-exit"), QStyle::SP_DialogCloseButton),
        tr("Quit"), this, &QWidget::close);
    quitAction->setShortcut(QKeySequence::Quit);

    QAction *settingsAction = menuBar()->addAction(tr("Settings"));
    settingsAction->setShortcut(QKeySequence(QStringLiteral("Ctrl+,")));
    connect(settingsAction, &QAction::triggered, this, &MainWindow::openSettings);

    QAction *templateAction = menuBar()->addAction(tr("Template Manager"));
    connect(templateAction, &QAction::triggered, this, &MainWindow::openTemplates);

    QAction *aboutAction = menuBar()->addAction(tr("About"));
    connect(aboutAction, &QAction::triggered, this, [this]() {
        QMessageBox::about(this,
                           tr("About MemGraph"),
                           tr("MemGraph %1\nVersion updated: %2\n\nA knowledge learning tool that helps users understand, connect, remember, and transfer complex concepts.")
                               .arg(QApplication::applicationVersion(), versionUpdatedAt()));
    });

    mapList_ = new QListWidget(this);
    mapList_->setAccessibleName(tr("Knowledge Maps"));
    mapList_->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    mapList_->setTextElideMode(Qt::ElideRight);
    auto *newMapButton = new QPushButton(
        UiTheme::icon(QStringLiteral("list-add"), QStyle::SP_FileDialogNewFolder), tr("New Map"), this);
    newMapButton->setProperty("variant", QStringLiteral("primary"));
    connect(newMapButton, &QPushButton::clicked, this, &MainWindow::createMap);
    connect(mapList_, &QListWidget::currentItemChanged, this, [this](QListWidgetItem *current) {
        if (current) {
            loadMap(current->data(Qt::UserRole).toLongLong());
        }
    });
    mapList_->setContextMenuPolicy(Qt::CustomContextMenu);
    connect(mapList_, &QListWidget::customContextMenuRequested, this, [this](const QPoint &pos) {
        QListWidgetItem *item = mapList_->itemAt(pos);
        if (!item) {
            return;
        }
        mapList_->setCurrentItem(item);
        QMenu menu(this);
        menu.addAction(renameMapAction_);
        menu.addAction(exportMapAction_);
        menu.addSeparator();
        menu.addAction(deleteMapAction_);
        menu.exec(mapList_->mapToGlobal(pos));
    });

    auto *leftPanel = new QFrame(this);
    leftPanel->setProperty("role", QStringLiteral("sidePanel"));
    leftPanel->setMinimumWidth(220);
    auto *leftLayout = new QVBoxLayout(leftPanel);
    leftLayout->setContentsMargins(16, 18, 16, 16);
    leftLayout->setSpacing(10);
    auto *mapTitle = new QLabel(tr("Knowledge Maps"), leftPanel);
    mapTitle->setProperty("role", QStringLiteral("title"));
    leftLayout->addWidget(mapTitle);
    leftLayout->addWidget(mapList_, 1);
    leftLayout->addWidget(newMapButton);

    canvas_ = new GraphCanvas(this);
    connect(canvas_, &GraphCanvas::currentNodeChanged, this, [this](qint64 nodeId) {
        currentNodeId_ = nodeId;
        refreshSelectedNode();
    });
    connect(canvas_, &GraphCanvas::nodeMoved, this, [this](qint64 nodeId, const QPointF &position) {
        store_->updateNodePosition(nodeId, position.x(), position.y());
        if (nodes_.contains(nodeId)) {
            NodeRecord node = nodes_.value(nodeId);
            node.x = position.x();
            node.y = position.y();
            nodes_.insert(nodeId, node);
        }
    });
    connect(canvas_, &GraphCanvas::createNodeRequested, this, &MainWindow::createNodeAtPosition);
    connect(canvas_, &GraphCanvas::deleteNodeRequested, this, &MainWindow::deleteNodeById);

    conceptEdit_ = new QLineEdit(this);
    conceptEdit_->setPlaceholderText(tr("Enter a concept"));
    conceptEdit_->setClearButtonEnabled(true);
    templateCombo_ = new QComboBox(this);
    generateButton_ = new QPushButton(
        UiTheme::icon(QStringLiteral("media-playback-start"), QStyle::SP_MediaPlay), tr("Generate"), this);
    generateButton_->setProperty("variant", QStringLiteral("primary"));
    generateButton_->setShortcut(QKeySequence(QStringLiteral("Ctrl+Return")));
    connect(generateButton_, &QPushButton::clicked, this, &MainWindow::generateRootNode);
    connect(conceptEdit_, &QLineEdit::returnPressed, this, &MainWindow::generateRootNode);
    connect(conceptEdit_, &QLineEdit::textChanged, this, &MainWindow::updateActionStates);

    markdownView_ = new SafeMarkdownBrowser(this);
    markdownView_->document()->setDefaultStyleSheet(
        QStringLiteral("h1 { font-size: 18pt; font-weight: 600; margin: 8px 0 12px 0; } "
                       "h2 { font-size: 15pt; font-weight: 600; margin: 14px 0 8px 0; } "
                       "h3 { font-size: 13pt; font-weight: 600; margin: 12px 0 6px 0; } "
                       "p, li { line-height: 145%; } pre, code { font-family: monospace; }"));
    markdownView_->setContextMenuPolicy(Qt::CustomContextMenu);
    connect(markdownView_, &QTextBrowser::customContextMenuRequested, this, [this](const QPoint &pos) {
        QMenu *menu = markdownView_->createStandardContextMenu();
        menu->addSeparator();
        QAction *createNodeAction = menu->addAction(tr("Create linked node from selection"));
        createNodeAction->setEnabled(!markdownView_->textCursor().selectedText().trimmed().isEmpty() && currentNodeId_ > 0);
        QAction *chosen = menu->exec(markdownView_->mapToGlobal(pos));
        if (chosen == createNodeAction) {
            createNodeFromSelection();
        }
        delete menu;
    });

    copyNodeAction_ = new QAction(
        UiTheme::icon(QStringLiteral("edit-copy"), QStyle::SP_FileIcon), tr("Copy Node Markdown"), this);
    editNodeAction_ = new QAction(
        UiTheme::icon(QStringLiteral("document-edit"), QStyle::SP_FileDialogDetailedView), tr("Edit Node"), this);
    connectNodeAction_ = new QAction(
        UiTheme::icon(QStringLiteral("insert-link"), QStyle::SP_ArrowRight), tr("Connect Node"), this);
    updateRelationAction_ = new QAction(
        UiTheme::icon(QStringLiteral("view-refresh"), QStyle::SP_BrowserReload), tr("Update Relation"), this);
    deleteNodeAction_ = new QAction(
        UiTheme::icon(QStringLiteral("edit-delete"), QStyle::SP_TrashIcon), tr("Delete Node"), this);
    restoreNodeAction_ = new QAction(
        UiTheme::icon(QStringLiteral("edit-undo"), QStyle::SP_ArrowBack), tr("Restore Node"), this);
    connect(copyNodeAction_, &QAction::triggered, this, &MainWindow::copyNodeMarkdown);
    connect(editNodeAction_, &QAction::triggered, this, &MainWindow::editSelectedNode);
    connect(connectNodeAction_, &QAction::triggered, this, &MainWindow::connectSelectedNode);
    connect(updateRelationAction_, &QAction::triggered, this, &MainWindow::updateRelationDescription);
    connect(deleteNodeAction_, &QAction::triggered, this, &MainWindow::deleteSelectedNode);
    connect(restoreNodeAction_, &QAction::triggered, this, &MainWindow::restoreDeletedNode);

    statusLabel_ = new QLabel(tr("Ready."), this);
    statusLabel_->setProperty("role", QStringLiteral("muted"));
    statusBar()->addWidget(statusLabel_, 1);

    auto *rightPanel = new QFrame(this);
    rightPanel->setProperty("role", QStringLiteral("sidePanel"));
    rightPanel->setMinimumWidth(320);
    auto *rightLayout = new QVBoxLayout(rightPanel);
    rightLayout->setContentsMargins(18, 18, 18, 16);
    rightLayout->setSpacing(10);
    auto *explainTitle = new QLabel(tr("Explain & Connect"), rightPanel);
    explainTitle->setProperty("role", QStringLiteral("title"));
    rightLayout->addWidget(explainTitle);
    auto *conceptLabel = new QLabel(tr("Concept"), rightPanel);
    conceptLabel->setProperty("role", QStringLiteral("muted"));
    rightLayout->addWidget(conceptLabel);
    auto *conceptRow = new QHBoxLayout;
    conceptRow->setSpacing(8);
    conceptRow->addWidget(conceptEdit_, 1);
    conceptRow->addWidget(generateButton_);
    rightLayout->addLayout(conceptRow);
    auto *templateLabel = new QLabel(tr("Explanation Template"), rightPanel);
    templateLabel->setProperty("role", QStringLiteral("muted"));
    rightLayout->addWidget(templateLabel);
    rightLayout->addWidget(templateCombo_);

    auto *markdownHeader = new QHBoxLayout;
    auto *markdownTitle = new QLabel(tr("Node Markdown"), rightPanel);
    markdownTitle->setProperty("role", QStringLiteral("sectionTitle"));
    markdownHeader->addWidget(markdownTitle);
    markdownHeader->addStretch();
    auto *moreMenu = new QMenu(rightPanel);
    moreMenu->addAction(copyNodeAction_);
    moreMenu->addSeparator();
    moreMenu->addAction(editNodeAction_);
    moreMenu->addAction(connectNodeAction_);
    moreMenu->addAction(updateRelationAction_);
    moreMenu->addSeparator();
    moreMenu->addAction(deleteNodeAction_);
    moreMenu->addAction(restoreNodeAction_);
    auto *moreButton = new QToolButton(rightPanel);
    moreButton->setText(tr("More"));
    moreButton->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
    moreButton->setPopupMode(QToolButton::InstantPopup);
    moreButton->setMenu(moreMenu);
    markdownHeader->addWidget(moreButton);
    rightLayout->addLayout(markdownHeader);
    rightLayout->addWidget(markdownView_, 1);

    auto *splitter = new QSplitter(this);
    splitter->setChildrenCollapsible(false);
    splitter->addWidget(leftPanel);
    splitter->addWidget(canvas_);
    splitter->addWidget(rightPanel);
    splitter->setStretchFactor(0, 1);
    splitter->setStretchFactor(1, 5);
    splitter->setStretchFactor(2, 3);
    splitter->setSizes({230, 650, 400});
    setCentralWidget(splitter);
    updateActionStates();
}

void MainWindow::reloadMaps()
{
    const qint64 previousMapId = currentMapId_;
    mapList_->clear();
    maps_.clear();

    const QList<MapRecord> mapRecords = store_->maps();
    for (const MapRecord &map : mapRecords) {
        maps_.insert(map.id, map);
        auto *item = new QListWidgetItem(map.title, mapList_);
        item->setData(Qt::UserRole, map.id);
        item->setToolTip(map.title);
    }

    if (mapList_->count() == 0) {
        currentMapId_ = 0;
        currentNodeId_ = 0;
        nodes_.clear();
        edges_.clear();
        canvas_->setGraph({}, {});
        refreshSelectedNode();
        updateActionStates();
        return;
    }

    int rowToSelect = 0;
    for (int row = 0; row < mapList_->count(); ++row) {
        if (mapList_->item(row)->data(Qt::UserRole).toLongLong() == previousMapId) {
            rowToSelect = row;
            break;
        }
    }
    mapList_->setCurrentRow(rowToSelect);
}

void MainWindow::reloadTemplates()
{
    const qint64 previousId = templateCombo_->currentData().toLongLong();
    templateCombo_->clear();

    const QList<PromptTemplate> promptTemplates = store_->templates();
    for (const PromptTemplate &promptTemplate : promptTemplates) {
        templateCombo_->addItem(promptTemplate.name + (promptTemplate.isDefault ? tr(" (Default)") : QString()), promptTemplate.id);
    }

    int index = templateCombo_->findData(previousId);
    if (index < 0) {
        for (int i = 0; i < templateCombo_->count(); ++i) {
            const PromptTemplate promptTemplate = store_->promptTemplate(templateCombo_->itemData(i).toLongLong());
            if (promptTemplate.isDefault) {
                index = i;
                break;
            }
        }
    }
    if (index >= 0) {
        templateCombo_->setCurrentIndex(index);
    }
}

void MainWindow::loadMap(qint64 mapId)
{
    if (mapId <= 0) {
        return;
    }

    currentMapId_ = mapId;
    nodes_.clear();
    const QList<NodeRecord> nodeRecords = store_->nodes(mapId);
    for (const NodeRecord &node : nodeRecords) {
        nodes_.insert(node.id, node);
    }
    if (!nodes_.contains(currentNodeId_)) {
        currentNodeId_ = 0;
    }
    edges_ = store_->edges(mapId);
    canvas_->setGraph(nodeRecords, edges_);
    refreshSelectedNode();
    updateActionStates();
}

void MainWindow::refreshSelectedNode()
{
    const NodeRecord node = currentNode();
    if (node.id == 0) {
        setMarkdownText(tr("# No node selected\n\nCreate or select a node to view its explanation."));
        updateActionStates();
        return;
    }
    setMarkdownText(node.markdown);
    conceptEdit_->setText(node.title);
    updateActionStates();
}

void MainWindow::updateActionStates()
{
    const bool hasMap = currentMapId_ > 0;
    const bool hasNode = currentNodeId_ > 0 && nodes_.contains(currentNodeId_);
    const bool hasMultipleNodes = hasNode && nodes_.size() >= 2;

    if (generateButton_) {
        generateButton_->setEnabled(hasMap && !conceptEdit_->text().trimmed().isEmpty());
    }
    if (renameMapAction_) {
        renameMapAction_->setEnabled(hasMap);
    }
    if (deleteMapAction_) {
        deleteMapAction_->setEnabled(hasMap);
    }
    if (exportMapAction_) {
        exportMapAction_->setEnabled(hasMap);
    }
    if (copyNodeAction_) {
        copyNodeAction_->setEnabled(hasNode);
    }
    if (editNodeAction_) {
        editNodeAction_->setEnabled(hasNode);
    }
    if (connectNodeAction_) {
        connectNodeAction_->setEnabled(hasMultipleNodes);
    }
    if (updateRelationAction_) {
        updateRelationAction_->setEnabled(hasMultipleNodes);
    }
    if (deleteNodeAction_) {
        deleteNodeAction_->setEnabled(hasNode);
    }
    if (restoreNodeAction_) {
        restoreNodeAction_->setEnabled(hasMap);
    }
}

void MainWindow::setMarkdownText(const QString &markdown)
{
#if QT_VERSION >= QT_VERSION_CHECK(5, 14, 0)
    markdownView_->setMarkdown(markdown);
#else
    markdownView_->setPlainText(markdown);
#endif
}

MapRecord MainWindow::currentMap() const
{
    return maps_.value(currentMapId_);
}

NodeRecord MainWindow::currentNode() const
{
    if (currentNodeId_ <= 0) {
        return {};
    }
    return nodeById(currentNodeId_);
}

NodeRecord MainWindow::nodeById(qint64 nodeId) const
{
    return nodes_.value(nodeId);
}

QPointF MainWindow::nextNodePosition(qint64 parentNodeId) const
{
    if (parentNodeId > 0 && nodes_.contains(parentNodeId)) {
        const NodeRecord parent = nodes_.value(parentNodeId);
        return QPointF(parent.x + 260, parent.y + 90);
    }
    return QPointF((nodes_.size() % 6) * 230, (nodes_.size() / 6) * 130);
}

QString MainWindow::promptLanguage() const
{
    QString language = settings_->uiLanguage();
    if (language == QStringLiteral("system")) {
        language = QLocale::system().name();
    }
    return language.startsWith(QStringLiteral("zh")) ? QStringLiteral("中文") : QStringLiteral("English");
}

void MainWindow::createMap()
{
    bool ok = false;
    const QString title = QInputDialog::getText(this, tr("New Map"), tr("Map title"), QLineEdit::Normal, tr("Untitled Map"), &ok);
    if (!ok) {
        return;
    }
    QString error;
    const MapRecord map = store_->createMap(title, &error);
    if (map.id == 0) {
        QMessageBox::warning(this, tr("New Map"), error);
        return;
    }
    currentMapId_ = map.id;
    reloadMaps();
}

void MainWindow::renameCurrentMap()
{
    const MapRecord map = currentMap();
    if (map.id == 0) {
        QMessageBox::information(this, tr("Rename Map"), tr("Select a map to rename first."));
        return;
    }

    bool ok = false;
    const QString title = QInputDialog::getText(this, tr("Rename Map"), tr("Map title"), QLineEdit::Normal, map.title, &ok);
    if (!ok) {
        return;
    }

    QString error;
    if (!store_->updateMapTitle(map.id, title, &error)) {
        QMessageBox::warning(this, tr("Rename Map"), error.isEmpty() ? tr("Unable to rename the map.") : error);
        return;
    }

    currentMapId_ = map.id;
    reloadMaps();
    statusLabel_->setText(tr("Map renamed."));
}

void MainWindow::deleteCurrentMap()
{
    const MapRecord map = currentMap();
    if (map.id == 0) {
        QMessageBox::information(this, tr("Delete Map"), tr("Select a map to delete first."));
        return;
    }

    if (QMessageBox::question(this,
                              tr("Delete Map"),
                              tr("Move map \"%1\" to Recycle Bin?").arg(map.title))
        != QMessageBox::Yes) {
        return;
    }

    QString error;
    if (!store_->deleteMap(map.id, &error)) {
        QMessageBox::warning(this, tr("Delete Map"), error.isEmpty() ? tr("Unable to delete the map.") : error);
        return;
    }

    pendingGenerations_.clear();
    pendingRelationGenerations_.clear();
    currentMapId_ = 0;
    currentNodeId_ = 0;
    reloadMaps();
    statusLabel_->setText(tr("Map moved to Recycle Bin."));
}

void MainWindow::openTrash()
{
    QDialog dialog(this);
    dialog.setWindowTitle(tr("Recycle Bin"));
    dialog.resize(760, 520);

    auto *tabs = new QTabWidget(&dialog);
    auto *mapsList = new QListWidget(tabs);
    auto *nodesList = new QListWidget(tabs);
    auto *templatesList = new QListWidget(tabs);
    tabs->addTab(mapsList, tr("Maps"));
    tabs->addTab(nodesList, tr("Nodes"));
    tabs->addTab(templatesList, tr("Templates"));

    auto reloadTrash = [&]() {
        mapsList->clear();
        nodesList->clear();
        templatesList->clear();

        QString error;
        const QList<MapRecord> maps = store_->deletedMaps(&error);
        if (!error.isEmpty()) {
            QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
            return;
        }
        for (const MapRecord &map : maps) {
            auto *item = new QListWidgetItem(QStringLiteral("%1 (#%2)").arg(map.title).arg(map.id), mapsList);
            item->setData(Qt::UserRole, map.id);
        }

        const QList<NodeRecord> nodes = store_->deletedNodes(&error);
        if (!error.isEmpty()) {
            QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
            return;
        }
        for (const NodeRecord &node : nodes) {
            auto *item = new QListWidgetItem(QStringLiteral("%1 (#%2, map #%3)").arg(node.title).arg(node.id).arg(node.mapId), nodesList);
            item->setData(Qt::UserRole, node.id);
            item->setData(Qt::UserRole + 1, node.mapId);
        }

        const QList<PromptTemplate> templates = store_->deletedTemplates(&error);
        if (!error.isEmpty()) {
            QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
            return;
        }
        for (const PromptTemplate &promptTemplate : templates) {
            auto *item = new QListWidgetItem(QStringLiteral("%1 (#%2)").arg(promptTemplate.name).arg(promptTemplate.id), templatesList);
            item->setData(Qt::UserRole, promptTemplate.id);
        }
    };

    auto *restoreButton = new QPushButton(tr("Restore Selected"), &dialog);
    auto *emptyButton = new QPushButton(tr("Empty Recycle Bin"), &dialog);
    auto *closeButton = new QPushButton(tr("Close"), &dialog);

    connect(restoreButton, &QPushButton::clicked, &dialog, [&]() {
        QString error;
        if (tabs->currentWidget() == mapsList) {
            QListWidgetItem *item = mapsList->currentItem();
            if (!item) {
                return;
            }
            if (!store_->restoreMap(item->data(Qt::UserRole).toLongLong(), &error)) {
                QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
                return;
            }
        } else if (tabs->currentWidget() == nodesList) {
            QListWidgetItem *item = nodesList->currentItem();
            if (!item) {
                return;
            }
            if (!store_->restoreNode(item->data(Qt::UserRole).toLongLong(), &error)) {
                QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
                return;
            }
        } else {
            QListWidgetItem *item = templatesList->currentItem();
            if (!item) {
                return;
            }
            if (!store_->restoreTemplate(item->data(Qt::UserRole).toLongLong(), &error)) {
                QMessageBox::warning(&dialog, tr("Recycle Bin"), error);
                return;
            }
        }
        reloadTrash();
        reloadMaps();
        reloadTemplates();
        if (currentMapId_ > 0) {
            loadMap(currentMapId_);
        }
        statusLabel_->setText(tr("Item restored."));
    });

    connect(emptyButton, &QPushButton::clicked, &dialog, [&]() {
        if (QMessageBox::question(&dialog,
                                  tr("Empty Recycle Bin"),
                                  tr("Permanently delete all maps, nodes, and templates in Recycle Bin? This cannot be undone."))
            != QMessageBox::Yes) {
            return;
        }
        QString error;
        if (!store_->emptyTrash(&error)) {
            QMessageBox::warning(&dialog, tr("Empty Recycle Bin"), error);
            return;
        }
        reloadTrash();
        reloadMaps();
        reloadTemplates();
        if (currentMapId_ > 0) {
            loadMap(currentMapId_);
        }
        statusLabel_->setText(tr("Recycle Bin emptied."));
    });
    connect(closeButton, &QPushButton::clicked, &dialog, &QDialog::accept);

    auto *buttonRow = new QHBoxLayout;
    buttonRow->addWidget(restoreButton);
    buttonRow->addWidget(emptyButton);
    buttonRow->addStretch();
    buttonRow->addWidget(closeButton);

    auto *layout = new QVBoxLayout(&dialog);
    layout->addWidget(tabs, 1);
    layout->addLayout(buttonRow);

    reloadTrash();
    dialog.exec();
    reloadMaps();
    reloadTemplates();
}

void MainWindow::generateRootNode()
{
    const QString concept = conceptEdit_->text().trimmed();
    if (concept.isEmpty()) {
        QMessageBox::information(this, tr("Generate"), tr("Enter a concept first."));
        return;
    }

    if (currentMapId_ == 0) {
        QString error;
        const MapRecord map = store_->createMap(tr("Untitled Map"), &error);
        if (map.id == 0) {
            QMessageBox::warning(this, tr("Generate"), error);
            return;
        }
        currentMapId_ = map.id;
        reloadMaps();
    }

    const NodeRecord selectedNode = currentNode();
    if (selectedNode.id > 0 && selectedNode.title.trimmed() == concept) {
        startGenerationForExistingNode(selectedNode.id, concept);
        return;
    }

    startGeneration(concept, 0, QString(), nextNodePosition(0));
}

void MainWindow::createNodeAtPosition(const QPointF &position)
{
    QDialog dialog(this);
    dialog.setWindowTitle(tr("New Node"));

    auto *conceptEdit = new QLineEdit(&dialog);
    conceptEdit->setText(conceptEdit_->text().trimmed());
    conceptEdit->setPlaceholderText(tr("Enter a concept"));
    auto *generateCheck = new QCheckBox(tr("Generate explanation now"), &dialog);
    generateCheck->setChecked(false);

    auto *form = new QFormLayout;
    form->addRow(tr("Concept"), conceptEdit);
    form->addRow(QString(), generateCheck);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, &dialog);
    connect(buttons, &QDialogButtonBox::accepted, &dialog, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);

    auto *layout = new QVBoxLayout(&dialog);
    layout->addLayout(form);
    layout->addWidget(buttons);

    if (dialog.exec() != QDialog::Accepted) {
        return;
    }

    const QString concept = conceptEdit->text().trimmed();
    if (concept.isEmpty()) {
        QMessageBox::information(this, tr("New Node"), tr("Enter a concept first."));
        return;
    }

    if (currentMapId_ == 0) {
        QString error;
        const MapRecord map = store_->createMap(tr("Untitled Map"), &error);
        if (map.id == 0) {
            QMessageBox::warning(this, tr("New Node"), error);
            return;
        }
        currentMapId_ = map.id;
        reloadMaps();
    }

    if (generateCheck->isChecked()) {
        startGeneration(concept, 0, QString(), position);
        return;
    }

    QString error;
    const NodeRecord created = store_->createNode(currentMapId_,
                                                  concept,
                                                  tr("# %1\n\nAdd or generate an explanation for this concept.").arg(concept),
                                                  templateCombo_->currentData().toLongLong(),
                                                  position.x(),
                                                  position.y(),
                                                  QStringLiteral("ready"),
                                                  &error);
    if (created.id == 0) {
        QMessageBox::warning(this, tr("New Node"), error);
        return;
    }

    loadMap(currentMapId_);
    canvas_->selectNode(created.id);
    statusLabel_->setText(tr("Node created."));
}

void MainWindow::createNodeFromSelection()
{
    QString selected = markdownView_->textCursor().selectedText().trimmed();
    selected.replace(QChar(0x2029), QLatin1Char('\n'));
    selected.replace(QChar(0x2028), QLatin1Char('\n'));

    if (selected.isEmpty() || currentNodeId_ == 0) {
        return;
    }
    if (settings_->autoGenerateLinkedNodes()) {
        startGeneration(selected, currentNodeId_, selected, nextNodePosition(currentNodeId_));
        return;
    }

    QString error;
    const QPointF position = nextNodePosition(currentNodeId_);
    const NodeRecord created = store_->createNode(currentMapId_,
                                                  selected,
                                                  tr("# %1\n\nAdd or generate an explanation for this linked concept.").arg(selected),
                                                  templateCombo_->currentData().toLongLong(),
                                                  position.x(),
                                                  position.y(),
                                                  QStringLiteral("ready"),
                                                  &error);
    if (created.id == 0) {
        QMessageBox::warning(this, tr("Create Node"), error);
        return;
    }
    store_->createEdge(currentMapId_, currentNodeId_, created.id, QStringLiteral("explains"), selected);
    loadMap(currentMapId_);
    canvas_->selectNode(created.id);
    statusLabel_->setText(tr("Linked node created."));
}

void MainWindow::deleteSelectedNode()
{
    const NodeRecord node = currentNode();
    if (node.id == 0) {
        QMessageBox::information(this, tr("Delete Node"), tr("Select a node to delete first."));
        return;
    }

    deleteNodeById(node.id);
}

void MainWindow::deleteNodeById(qint64 nodeId)
{
    const NodeRecord node = nodeById(nodeId);
    if (node.id == 0) {
        QMessageBox::information(this, tr("Delete Node"), tr("Select a node to delete first."));
        return;
    }

    if (QMessageBox::question(this,
                              tr("Delete Node"),
                              tr("Move node \"%1\" to deleted nodes? You can restore it later. Connected edges will be hidden while the node is deleted.").arg(node.title))
        != QMessageBox::Yes) {
        return;
    }

    QString error;
    if (!store_->deleteNode(node.id, &error)) {
        QMessageBox::warning(this, tr("Delete Node"), error);
        return;
    }

    pendingGenerations_.remove(node.id);
    currentNodeId_ = 0;
    loadMap(currentMapId_);
    statusLabel_->setText(tr("Node deleted."));
}

void MainWindow::restoreDeletedNode()
{
    if (currentMapId_ == 0) {
        return;
    }

    QString error;
    const QList<NodeRecord> deleted = store_->deletedNodes(currentMapId_, &error);
    if (!error.isEmpty()) {
        QMessageBox::warning(this, tr("Restore Node"), error);
        return;
    }
    if (deleted.isEmpty()) {
        QMessageBox::information(this, tr("Restore Node"), tr("There are no deleted nodes to restore."));
        return;
    }

    QStringList labels;
    QHash<QString, qint64> idByLabel;
    for (const NodeRecord &node : deleted) {
        const QString label = QStringLiteral("%1 (#%2)").arg(node.title).arg(node.id);
        labels.append(label);
        idByLabel.insert(label, node.id);
    }

    bool ok = false;
    const QString chosen = QInputDialog::getItem(this, tr("Restore Node"), tr("Deleted node"), labels, 0, false, &ok);
    if (!ok || chosen.isEmpty()) {
        return;
    }

    const qint64 nodeId = idByLabel.value(chosen);
    if (!store_->restoreNode(nodeId, &error)) {
        QMessageBox::warning(this, tr("Restore Node"), error);
        return;
    }

    loadMap(currentMapId_);
    canvas_->selectNode(nodeId);
    statusLabel_->setText(tr("Node restored."));
}

void MainWindow::editSelectedNode()
{
    const NodeRecord node = currentNode();
    if (node.id == 0) {
        QMessageBox::information(this, tr("Edit Node"), tr("Select a node to edit first."));
        return;
    }

    QDialog dialog(this);
    dialog.setWindowTitle(tr("Edit Node"));
    dialog.resize(760, 560);

    auto *titleEdit = new QLineEdit(node.title, &dialog);
    auto *markdownEdit = new QTextEdit(&dialog);
    markdownEdit->setPlainText(node.markdown);

    auto *form = new QFormLayout;
    form->addRow(tr("Title"), titleEdit);
    form->addRow(tr("Markdown"), markdownEdit);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, &dialog);
    connect(buttons, &QDialogButtonBox::accepted, &dialog, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);

    auto *layout = new QVBoxLayout(&dialog);
    layout->addLayout(form, 1);
    layout->addWidget(buttons);

    if (dialog.exec() != QDialog::Accepted) {
        return;
    }

    QString error;
    if (!store_->updateNodeContent(node.id, titleEdit->text(), markdownEdit->toPlainText(), &error)) {
        QMessageBox::warning(this, tr("Edit Node"), error);
        return;
    }
    loadMap(currentMapId_);
    canvas_->selectNode(node.id);
    statusLabel_->setText(tr("Node updated."));
}

void MainWindow::connectSelectedNode()
{
    const NodeRecord source = currentNode();
    if (source.id == 0) {
        QMessageBox::information(this, tr("Connect Node"), tr("Select a source node first."));
        return;
    }
    if (nodes_.size() < 2) {
        QMessageBox::information(this, tr("Connect Node"), tr("At least two active nodes are needed to create a connection."));
        return;
    }

    QStringList labels;
    QHash<QString, qint64> idByLabel;
    for (const NodeRecord &node : std::as_const(nodes_)) {
        if (node.id == source.id) {
            continue;
        }
        const QString label = QStringLiteral("%1 (#%2)").arg(node.title).arg(node.id);
        labels.append(label);
        idByLabel.insert(label, node.id);
    }
    labels.sort();

    bool ok = false;
    const QString chosen = QInputDialog::getItem(this, tr("Connect Node"), tr("Target node"), labels, 0, false, &ok);
    if (!ok || chosen.isEmpty()) {
        return;
    }

    const QString label = QInputDialog::getText(this, tr("Connect Node"), tr("Connection label"), QLineEdit::Normal, tr("related"), &ok);
    if (!ok) {
        return;
    }

    QString error;
    const EdgeRecord edge = store_->createEdge(currentMapId_, source.id, idByLabel.value(chosen), QStringLiteral("manual"), label, &error);
    if (edge.id == 0) {
        QMessageBox::warning(this, tr("Connect Node"), error);
        return;
    }

    loadMap(currentMapId_);
    canvas_->selectNode(source.id);
    statusLabel_->setText(tr("Nodes connected."));
}

void MainWindow::updateRelationDescription()
{
    if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
        QMessageBox::information(this, tr("Settings"), tr("Open Settings and enter an API key before generating explanations."));
        openSettings();
        if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
            return;
        }
    }

    if (currentMapId_ == 0) {
        QMessageBox::information(this, tr("Update Relation"), tr("Create or select a map first."));
        return;
    }
    if (nodes_.size() < 2) {
        QMessageBox::information(this, tr("Update Relation"), tr("At least two active nodes are needed to create or update a relation."));
        return;
    }

    QStringList nodeLabels;
    QHash<QString, qint64> nodeIdByLabel;
    for (const NodeRecord &node : std::as_const(nodes_)) {
        const QString label = QStringLiteral("%1 (#%2)").arg(node.title).arg(node.id);
        nodeLabels.append(label);
        nodeIdByLabel.insert(label, node.id);
    }
    nodeLabels.sort();

    bool ok = false;
    int sourceIndex = 0;
    const NodeRecord selectedSource = currentNode();
    if (selectedSource.id > 0) {
        const QString selectedLabel = QStringLiteral("%1 (#%2)").arg(selectedSource.title).arg(selectedSource.id);
        sourceIndex = nodeLabels.indexOf(selectedLabel);
        if (sourceIndex < 0) {
            sourceIndex = 0;
        }
    }
    const QString chosenSource = QInputDialog::getItem(this, tr("Update Relation"), tr("Source node"), nodeLabels, sourceIndex, false, &ok);
    if (!ok || chosenSource.isEmpty()) {
        return;
    }
    const qint64 sourceNodeId = nodeIdByLabel.value(chosenSource);

    QStringList targetLabels;
    QHash<QString, qint64> targetIdByLabel;
    for (const QString &label : std::as_const(nodeLabels)) {
        const qint64 nodeId = nodeIdByLabel.value(label);
        if (nodeId == sourceNodeId) {
            continue;
        }
        targetLabels.append(label);
        targetIdByLabel.insert(label, nodeId);
    }

    const QString chosenTarget = QInputDialog::getItem(this, tr("Update Relation"), tr("Target node"), targetLabels, 0, false, &ok);
    if (!ok || chosenTarget.isEmpty()) {
        return;
    }
    const qint64 targetNodeId = targetIdByLabel.value(chosenTarget);

    EdgeRecord existingEdge;
    for (const EdgeRecord &edge : edges_) {
        if (edge.sourceNodeId == sourceNodeId && edge.targetNodeId == targetNodeId) {
            existingEdge = edge;
            break;
        }
    }

    QString error;
    qint64 edgeId = existingEdge.id;
    bool createdEdge = false;
    if (edgeId == 0) {
        const EdgeRecord edge = store_->createEdge(currentMapId_, sourceNodeId, targetNodeId, QStringLiteral("ai_relation"), QString(), &error);
        if (edge.id == 0) {
            QMessageBox::warning(this, tr("Update Relation"), error.isEmpty() ? tr("Unable to create the relation.") : error);
            return;
        }
        edgeId = edge.id;
        createdEdge = true;
        loadMap(currentMapId_);
        canvas_->selectNode(sourceNodeId);
    }

    const NodeRecord source = nodeById(sourceNodeId);
    const NodeRecord target = nodeById(targetNodeId);
    const QString existingRelationSection = extractRelationSection(source.markdown, targetNodeId);
    const QString currentRelation = existingRelationSection.isEmpty() ? existingEdge.label : existingRelationSection;
    const qint64 requestId = nextRelationRequestId_--;
    const QString systemPrompt = tr("You are MemGraph. Generate concise relationship descriptions for a knowledge graph. Output only the relationship description, no title, no bullet list, no markdown fence.");
    const QString userPrompt = tr("Knowledge map: %1\nLanguage: %2\n\nSource concept: %3\nSource explanation:\n%4\n\nTarget concept: %5\nTarget explanation:\n%6\n\nCurrent relationship description:\n%7\n\nWrite a clear relationship description explaining how the source concept connects to the target concept. Keep it concise and useful for learning.")
        .arg(currentMap().title,
             promptLanguage(),
             source.title,
             source.markdown,
             target.title,
             target.markdown,
             currentRelation);

    AiRequest request;
    request.nodeId = requestId;
    request.apiKey = secretStore_->apiKey();
    request.baseUrl = settings_->baseUrl();
    request.model = settings_->model();
    request.authMode = settings_->authMode();
    request.apiMode = settings_->apiMode();
    request.systemPrompt = systemPrompt;
    request.userPrompt = userPrompt;

    pendingRelationGenerations_.insert(requestId, PendingRelationGeneration{edgeId, sourceNodeId, targetNodeId, createdEdge});
    statusLabel_->setText(tr("Generating relation..."));
    aiClient_.generateExplanation(request);
}

void MainWindow::startGeneration(const QString &concept, qint64 parentNodeId, const QString &selectedText, const QPointF &position)
{
    if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
        QMessageBox::information(this, tr("Settings"), tr("Open Settings and enter an API key before generating explanations."));
        openSettings();
        if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
            return;
        }
    }

    const qint64 templateId = templateCombo_->currentData().toLongLong();
    PromptTemplate promptTemplate = store_->promptTemplate(templateId);
    if (promptTemplate.id == 0) {
        promptTemplate = store_->defaultTemplate();
    }

    const NodeRecord parent = nodeById(parentNodeId);
    const QString placeholder = tr("Generating explanation for **%1**...").arg(concept);
    QString error;
    const NodeRecord created = store_->createNode(currentMapId_, concept, placeholder, promptTemplate.id, position.x(), position.y(), QStringLiteral("generating"), &error);
    if (created.id == 0) {
        QMessageBox::warning(this, tr("Generate"), error);
        return;
    }

    if (parentNodeId > 0) {
        store_->createEdge(currentMapId_, parentNodeId, created.id, QStringLiteral("explains"), selectedText);
    }

    const TemplateContext context{
        concept,
        selectedText,
        parent.title,
        currentMap().title,
        parent.markdown,
        promptLanguage()
    };
    const auto rendered = templateEngine_.render(promptTemplate, context);
    const QString promptSnapshot = QStringLiteral("SYSTEM:\n%1\n\nUSER:\n%2").arg(rendered.first, rendered.second);

    AiRequest request;
    request.nodeId = created.id;
    request.apiKey = secretStore_->apiKey();
    request.baseUrl = settings_->baseUrl();
    request.model = settings_->model();
    request.authMode = settings_->authMode();
    request.apiMode = settings_->apiMode();
    request.systemPrompt = rendered.first;
    request.userPrompt = rendered.second;

    pendingGenerations_.insert(created.id, PendingGeneration{request.model, request.apiMode, promptSnapshot});
    store_->recordGeneration(created.id, request.model, request.apiMode, promptSnapshot, QStringLiteral("started"));
    loadMap(currentMapId_);
    canvas_->selectNode(created.id);
    statusLabel_->setText(tr("Generating..."));
    aiClient_.generateExplanation(request);
}

void MainWindow::startGenerationForExistingNode(qint64 nodeId, const QString &concept)
{
    if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
        QMessageBox::information(this, tr("Settings"), tr("Open Settings and enter an API key before generating explanations."));
        openSettings();
        if (settings_->authMode() == AuthMode::ApiKey && !secretStore_->hasApiKey()) {
            return;
        }
    }

    NodeRecord node = nodeById(nodeId);
    if (node.id == 0) {
        return;
    }

    EdgeRecord parentEdge;
    for (const EdgeRecord &edge : std::as_const(edges_)) {
        if (edge.targetNodeId == node.id) {
            parentEdge = edge;
            break;
        }
    }
    const NodeRecord parent = nodeById(parentEdge.sourceNodeId);

    const qint64 templateId = templateCombo_->currentData().toLongLong();
    PromptTemplate promptTemplate = store_->promptTemplate(templateId);
    if (promptTemplate.id == 0) {
        promptTemplate = store_->defaultTemplate();
    }

    const QString placeholder = tr("Generating explanation for **%1**...").arg(concept);
    QString error;
    if (!store_->updateNodeContent(node.id, concept, placeholder, &error)) {
        QMessageBox::warning(this, tr("Generate"), error);
        return;
    }
    store_->updateNodeMarkdown(node.id, placeholder, QStringLiteral("generating"));

    const TemplateContext context{
        concept,
        parentEdge.label,
        parent.title,
        currentMap().title,
        parent.markdown,
        promptLanguage()
    };
    const auto rendered = templateEngine_.render(promptTemplate, context);
    const QString promptSnapshot = QStringLiteral("SYSTEM:\n%1\n\nUSER:\n%2").arg(rendered.first, rendered.second);

    AiRequest request;
    request.nodeId = node.id;
    request.apiKey = secretStore_->apiKey();
    request.baseUrl = settings_->baseUrl();
    request.model = settings_->model();
    request.authMode = settings_->authMode();
    request.apiMode = settings_->apiMode();
    request.systemPrompt = rendered.first;
    request.userPrompt = rendered.second;

    pendingGenerations_.insert(node.id, PendingGeneration{request.model, request.apiMode, promptSnapshot});
    store_->recordGeneration(node.id, request.model, request.apiMode, promptSnapshot, QStringLiteral("started"));
    loadMap(currentMapId_);
    canvas_->selectNode(node.id);
    statusLabel_->setText(tr("Generating..."));
    aiClient_.generateExplanation(request);
}

void MainWindow::copyNodeMarkdown()
{
    const NodeRecord node = currentNode();
    if (node.id == 0) {
        return;
    }
    MarkdownExporter exporter;
    QApplication::clipboard()->setText(exporter.exportNode(node));
    statusLabel_->setText(tr("Node Markdown copied."));
}

void MainWindow::exportMapMarkdown()
{
    if (currentMapId_ == 0) {
        return;
    }
    const QString path = QFileDialog::getSaveFileName(this, tr("Export Map Markdown"), currentMap().title + QStringLiteral(".md"), tr("Markdown Files (*.md)"));
    if (path.isEmpty()) {
        return;
    }

    MarkdownExporter exporter;
    const QString markdown = exporter.exportMap(currentMap(), store_->nodes(currentMapId_), store_->edges(currentMapId_));

    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QMessageBox::warning(this, tr("Export"), file.errorString());
        return;
    }
    file.write(markdown.toUtf8());
    statusLabel_->setText(tr("Map Markdown exported."));
}

void MainWindow::openSettings()
{
    const QString previousDataDirectory = settings_->dataDirectory();
    const QString previousDatabasePath = settings_->databasePath();
    SettingsDialog dialog(settings_, secretStore_, this);
    if (dialog.exec() != QDialog::Accepted) {
        return;
    }

    const QString newDatabasePath = settings_->databasePath();
    if (newDatabasePath == previousDatabasePath) {
        return;
    }

    aiClient_.cancelAll();
    pendingGenerations_.clear();
    pendingRelationGenerations_.clear();
    QString error;
    if (!store_->open(newDatabasePath, &error)) {
        settings_->setDataDirectory(previousDataDirectory);
        QString restoreError;
        store_->open(previousDatabasePath, &restoreError);
        QMessageBox::warning(this,
                             tr("Data Directory"),
                             tr("Unable to open the selected data directory:\n%1").arg(error));
        return;
    }

    pendingGenerations_.clear();
    pendingRelationGenerations_.clear();
    currentMapId_ = 0;
    currentNodeId_ = 0;
    reloadTemplates();
    reloadMaps();
    statusLabel_->setText(tr("Data directory loaded."));
}

void MainWindow::openTemplates()
{
    TemplateDialog dialog(store_, this);
    connect(&dialog, &TemplateDialog::templatesChanged, this, &MainWindow::reloadTemplates);
    dialog.exec();
    reloadTemplates();
}
