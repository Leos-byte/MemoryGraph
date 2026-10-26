#include "ui/TemplateDialog.h"
#include "ui/UiTheme.h"

#include <QDialogButtonBox>
#include <QFontDatabase>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QMessageBox>
#include <QPushButton>
#include <QSplitter>
#include <QToolButton>
#include <QVBoxLayout>

namespace {
QString templateHelpText(bool chinese)
{
    if (chinese) {
        return QString::fromUtf8(
            "模板决定 MemGraph 如何向模型提问，从而生成某个概念的解释。\n\n"
            "必填项：\n"
            "1. 名称：用于在生成知识地图时选择模板。\n"
            "2. System Prompt：不能为空，用于定义模型角色、输出规则和语言要求。\n"
            "3. User Prompt：不能为空，并且必须包含 {{concept}}，否则系统无法把当前节点概念传给模型。\n\n"
            "System Prompt：用于设置稳定规则、角色、语言风格和输出要求。适合放长期不变的要求，例如“只输出 Markdown”“面向初学者解释”。\n\n"
            "User Prompt：用于描述当前这一次生成任务，并使用当前节点或地图中的变量。适合放解释结构、输出章节和本次任务说明。\n\n"
            "可用变量：\n"
            "{{concept}} - 要解释的目标概念，必填变量\n"
            "{{selected_text}} - 从父节点解释中选中的文本，扩展节点时建议使用\n"
            "{{parent_concept}} - 父节点标题，扩展节点时建议使用\n"
            "{{map_title}} - 当前知识地图标题，建议使用\n"
            "{{context_markdown}} - 父节点 Markdown 内容，建议使用\n"
            "{{language}} - 当前解释语言\n\n"
            "注意事项：保持章节标题稳定；要求模型只输出 Markdown；不要把 API Key、密码或隐私信息写进模板。");
    }

    return QStringLiteral(
        "Templates decide how MemGraph asks the model to explain a concept.\n\n"
        "Required fields:\n"
        "1. Name: used to choose the template while generating the knowledge map.\n"
        "2. System Prompt: required; defines model role, output rules, and language requirements.\n"
        "3. User Prompt: required and must contain {{concept}}, otherwise MemGraph cannot pass the current node concept to the model.\n\n"
        "System Prompt: sets stable rules, role, language style, and output requirements. Put long-lived instructions here, such as \"Output Markdown only\" or \"Explain for beginners\".\n\n"
        "User Prompt: describes the current task and uses variables from the selected node or map. Put the explanation structure here.\n\n"
        "Useful variables:\n"
        "{{concept}} - target concept; required variable\n"
        "{{selected_text}} - text selected from the parent explanation; recommended for expanded nodes\n"
        "{{parent_concept}} - parent node title; recommended for expanded nodes\n"
        "{{map_title}} - current map title; recommended\n"
        "{{context_markdown}} - parent node Markdown; recommended\n"
        "{{language}} - selected explanation language\n\n"
        "Tips: keep section headings stable, ask for Markdown only, and avoid putting API keys or private data into templates.");
}

QString starterSystemPrompt()
{
    return QStringLiteral(
        "You are MemGraph, a knowledge-learning assistant. Explain concepts for building a durable knowledge graph.\n\n"
        "Rules:\n"
        "- Output Markdown only.\n"
        "- Be precise, concrete, and easy to review later.\n"
        "- Explain in {{language}}.");
}

QString starterUserPrompt()
{
    return QStringLiteral(
        "Knowledge map: {{map_title}}\n"
        "Parent concept: {{parent_concept}}\n"
        "Selected text: {{selected_text}}\n"
        "Target concept: {{concept}}\n\n"
        "Existing context:\n"
        "{{context_markdown}}\n\n"
        "Please explain {{concept}} using stable Markdown sections.");
}
}

TemplateDialog::TemplateDialog(GraphStore *store, QWidget *parent)
    : QDialog(parent)
    , store_(store)
{
    setWindowTitle(tr("Template Manager"));
    resize(980, 680);
    setMinimumSize(760, 520);

    templateList_ = new QListWidget(this);
    templateList_->setAccessibleName(tr("Templates"));
    templateList_->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    templateList_->setTextElideMode(Qt::ElideRight);
    connect(templateList_, &QListWidget::currentItemChanged, this, [this](QListWidgetItem *current) {
        if (current) {
            showTemplate(current->data(Qt::UserRole).toLongLong());
        }
    });

    nameEdit_ = new QLineEdit(this);
    systemPromptEdit_ = new QTextEdit(this);
    userPromptEdit_ = new QTextEdit(this);
    const QFont fixedFont = QFontDatabase::systemFont(QFontDatabase::FixedFont);
    systemPromptEdit_->setFont(fixedFont);
    userPromptEdit_->setFont(fixedFont);
    systemPromptEdit_->setAcceptRichText(false);
    userPromptEdit_->setAcceptRichText(false);
    systemPromptEdit_->setTabChangesFocus(true);
    userPromptEdit_->setTabChangesFocus(true);
    defaultCheck_ = new QCheckBox(tr("Default template"), this);
    auto *helpButton = new QToolButton(this);
    helpButton->setIcon(UiTheme::icon(QString(), QStyle::SP_TitleBarContextHelpButton));
    helpButton->setAccessibleName(tr("Template help"));
    helpButton->setToolTip(tr("Template help"));
    connect(helpButton, &QToolButton::clicked, this, [this]() {
        const bool chinese = tr("Template Help") == QString::fromUtf8("模板帮助");
        QMessageBox::information(
            this,
            tr("Template Help"),
            templateHelpText(chinese));
    });

    auto *listPanel = new QFrame(this);
    listPanel->setProperty("role", QStringLiteral("sidePanel"));
    auto *listLayout = new QVBoxLayout(listPanel);
    listLayout->setContentsMargins(14, 14, 14, 14);
    auto *listTitle = new QLabel(tr("Templates"), listPanel);
    listTitle->setProperty("role", QStringLiteral("title"));
    listLayout->addWidget(listTitle);
    listLayout->addWidget(templateList_, 1);

    auto *editor = new QFrame(this);
    editor->setProperty("role", QStringLiteral("sidePanel"));
    auto *editorLayout = new QVBoxLayout(editor);
    editorLayout->setContentsMargins(18, 14, 18, 14);
    editorLayout->setSpacing(8);
    auto *editorTitle = new QLabel(tr("Template Details"), editor);
    editorTitle->setProperty("role", QStringLiteral("title"));
    editorLayout->addWidget(editorTitle);
    auto *nameRow = new QHBoxLayout;
    auto *nameLabel = new QLabel(tr("Name"), editor);
    nameLabel->setProperty("role", QStringLiteral("muted"));
    nameRow->addWidget(nameLabel);
    nameRow->addStretch();
    nameRow->addWidget(helpButton);
    editorLayout->addLayout(nameRow);
    editorLayout->addWidget(nameEdit_);
    auto *systemLabel = new QLabel(tr("System Prompt"), editor);
    systemLabel->setProperty("role", QStringLiteral("sectionTitle"));
    editorLayout->addWidget(systemLabel);
    editorLayout->addWidget(systemPromptEdit_, 1);
    auto *userLabel = new QLabel(tr("User Prompt"), editor);
    userLabel->setProperty("role", QStringLiteral("sectionTitle"));
    editorLayout->addWidget(userLabel);
    editorLayout->addWidget(userPromptEdit_, 2);
    editorLayout->addWidget(defaultCheck_);

    auto *splitter = new QSplitter(this);
    splitter->setChildrenCollapsible(false);
    splitter->addWidget(listPanel);
    splitter->addWidget(editor);
    splitter->setStretchFactor(0, 1);
    splitter->setStretchFactor(1, 4);

    splitter->setSizes({230, 750});

    auto *newButton = new QPushButton(
        UiTheme::icon(QStringLiteral("list-add"), QStyle::SP_FileDialogNewFolder), tr("New"), this);
    auto *copyButton = new QPushButton(
        UiTheme::icon(QStringLiteral("edit-copy"), QStyle::SP_FileIcon), tr("Copy"), this);
    auto *saveButton = new QPushButton(
        UiTheme::icon(QStringLiteral("document-save"), QStyle::SP_DialogSaveButton), tr("Save"), this);
    saveButton->setProperty("variant", QStringLiteral("primary"));
    saveButton->setShortcut(QKeySequence::Save);
    auto *deleteButton = new QPushButton(
        UiTheme::icon(QStringLiteral("edit-delete"), QStyle::SP_TrashIcon), tr("Delete"), this);
    deleteButton->setProperty("variant", QStringLiteral("danger"));
    auto *closeButton = new QPushButton(
        UiTheme::icon(QStringLiteral("window-close"), QStyle::SP_DialogCloseButton), tr("Close"), this);

    connect(newButton, &QPushButton::clicked, this, [this]() {
        QString error;
        const PromptTemplate created = store_->createTemplate(tr("New Template"), starterSystemPrompt(), starterUserPrompt(), false, &error);
        if (created.id == 0) {
            QMessageBox::warning(this, tr("Template"), error);
            return;
        }
        reload();
        showTemplate(created.id);
        emit templatesChanged();
    });

    connect(copyButton, &QPushButton::clicked, this, [this]() {
        const PromptTemplate source = currentTemplate();
        if (source.id == 0) {
            return;
        }

        QString error;
        const PromptTemplate created = store_->createTemplate(tr("%1 Copy").arg(source.name.trimmed().isEmpty() ? tr("Template") : source.name.trimmed()),
                                                              source.systemPrompt,
                                                              source.userPrompt,
                                                              false,
                                                              &error);
        if (created.id == 0) {
            QMessageBox::warning(this, tr("Template"), error);
            return;
        }
        reload();
        showTemplate(created.id);
        emit templatesChanged();
    });

    connect(saveButton, &QPushButton::clicked, this, [this]() {
        if (currentTemplateId_ == 0) {
            return;
        }
        const qint64 savedId = currentTemplateId_;
        const PromptTemplate edited = currentTemplate();
        QString validationMessage;
        if (!validateTemplate(edited, &validationMessage)) {
            QMessageBox::warning(this, tr("Template"), validationMessage);
            return;
        }

        QString error;
        if (!store_->updateTemplate(edited, &error)) {
            QMessageBox::warning(this, tr("Template"), error);
            return;
        }
        reload();
        showTemplate(savedId);
        emit templatesChanged();
    });

    connect(deleteButton, &QPushButton::clicked, this, [this]() {
        if (currentTemplateId_ == 0) {
            return;
        }
        if (QMessageBox::question(this, tr("Delete Template"), tr("Move template \"%1\" to Recycle Bin?").arg(nameEdit_->text())) != QMessageBox::Yes) {
            return;
        }
        QString error;
        if (!store_->deleteTemplate(currentTemplateId_, &error)) {
            QMessageBox::warning(this, tr("Template"), error);
            return;
        }
        reload();
        QMessageBox::information(this, tr("Template"), tr("Template moved to Recycle Bin."));
        emit templatesChanged();
    });

    connect(closeButton, &QPushButton::clicked, this, &TemplateDialog::accept);

    auto *buttons = new QHBoxLayout;
    buttons->addWidget(newButton);
    buttons->addWidget(copyButton);
    buttons->addWidget(deleteButton);
    buttons->addStretch();
    buttons->addWidget(closeButton);
    buttons->addWidget(saveButton);

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->setSpacing(12);
    layout->addWidget(splitter, 1);
    layout->addLayout(buttons);

    reload();
}

void TemplateDialog::reload()
{
    templateList_->clear();
    const QList<PromptTemplate> promptTemplates = store_->templates();
    for (const PromptTemplate &promptTemplate : promptTemplates) {
        auto *item = new QListWidgetItem(promptTemplate.name + (promptTemplate.isDefault ? tr(" (Default)") : QString()), templateList_);
        item->setData(Qt::UserRole, promptTemplate.id);
        item->setToolTip(item->text());
    }
    if (templateList_->count() > 0 && !templateList_->currentItem()) {
        templateList_->setCurrentRow(0);
    }
}

void TemplateDialog::showTemplate(qint64 templateId)
{
    const PromptTemplate promptTemplate = store_->promptTemplate(templateId);
    if (promptTemplate.id == 0) {
        return;
    }
    currentTemplateId_ = promptTemplate.id;
    nameEdit_->setText(promptTemplate.name);
    systemPromptEdit_->setPlainText(promptTemplate.systemPrompt);
    userPromptEdit_->setPlainText(promptTemplate.userPrompt);
    defaultCheck_->setChecked(promptTemplate.isDefault);

    for (int i = 0; i < templateList_->count(); ++i) {
        if (templateList_->item(i)->data(Qt::UserRole).toLongLong() == templateId) {
            templateList_->setCurrentRow(i);
            break;
        }
    }
}

PromptTemplate TemplateDialog::currentTemplate() const
{
    PromptTemplate promptTemplate;
    promptTemplate.id = currentTemplateId_;
    promptTemplate.name = nameEdit_->text();
    promptTemplate.systemPrompt = systemPromptEdit_->toPlainText();
    promptTemplate.userPrompt = userPromptEdit_->toPlainText();
    promptTemplate.isDefault = defaultCheck_->isChecked();
    return promptTemplate;
}

bool TemplateDialog::validateTemplate(const PromptTemplate &promptTemplate, QString *message) const
{
    if (promptTemplate.name.trimmed().isEmpty()) {
        if (message) {
            *message = tr("Template name is required.");
        }
        return false;
    }

    if (promptTemplate.systemPrompt.trimmed().isEmpty()) {
        if (message) {
            *message = tr("System Prompt is required.");
        }
        return false;
    }

    if (promptTemplate.userPrompt.trimmed().isEmpty()) {
        if (message) {
            *message = tr("User Prompt is required.");
        }
        return false;
    }

    if (!promptTemplate.userPrompt.contains(QStringLiteral("{{concept}}"))) {
        if (message) {
            *message = tr("User Prompt must contain {{concept}} so MemGraph can pass the selected concept to the model.");
        }
        return false;
    }

    return true;
}
