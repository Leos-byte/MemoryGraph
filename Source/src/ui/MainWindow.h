#pragma once

#include "api/AiClient.h"
#include "core/AppSettings.h"
#include "core/GraphStore.h"
#include "core/SecretStore.h"
#include "core/TemplateEngine.h"
#include "ui/GraphCanvas.h"

#include <QComboBox>
#include <QHash>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMainWindow>
#include <QPushButton>
#include <QTextBrowser>

class QAction;
class QToolButton;

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    MainWindow(GraphStore *store, AppSettings *settings, SecretStore *secretStore, QWidget *parent = nullptr);

private:
    struct PendingGeneration {
        QString model;
        ApiMode apiMode = ApiMode::Responses;
        QString promptSnapshot;
    };

    struct PendingRelationGeneration {
        qint64 edgeId = 0;
        qint64 sourceNodeId = 0;
        qint64 targetNodeId = 0;
        bool createdEdge = false;
    };

    void setupUi();
    void reloadMaps();
    void reloadTemplates();
    void loadMap(qint64 mapId);
    void refreshSelectedNode();
    void updateActionStates();
    void setMarkdownText(const QString &markdown);

    MapRecord currentMap() const;
    NodeRecord currentNode() const;
    NodeRecord nodeById(qint64 nodeId) const;
    QPointF nextNodePosition(qint64 parentNodeId) const;
    QString promptLanguage() const;

    void createMap();
    void renameCurrentMap();
    void deleteCurrentMap();
    void openTrash();
    void createNodeAtPosition(const QPointF &position);
    void deleteNodeById(qint64 nodeId);
    void generateRootNode();
    void createNodeFromSelection();
    void deleteSelectedNode();
    void restoreDeletedNode();
    void editSelectedNode();
    void connectSelectedNode();
    void updateRelationDescription();
    void startGeneration(const QString &concept, qint64 parentNodeId, const QString &selectedText, const QPointF &position);
    void startGenerationForExistingNode(qint64 nodeId, const QString &concept);
    void copyNodeMarkdown();
    void exportMapMarkdown();
    void openSettings();
    void openTemplates();

    GraphStore *store_ = nullptr;
    AppSettings *settings_ = nullptr;
    SecretStore *secretStore_ = nullptr;

    TemplateEngine templateEngine_;
    AiClient aiClient_;

    QListWidget *mapList_ = nullptr;
    GraphCanvas *canvas_ = nullptr;
    QLineEdit *conceptEdit_ = nullptr;
    QComboBox *templateCombo_ = nullptr;
    QTextBrowser *markdownView_ = nullptr;
    QLabel *statusLabel_ = nullptr;
    QPushButton *generateButton_ = nullptr;
    QAction *renameMapAction_ = nullptr;
    QAction *deleteMapAction_ = nullptr;
    QAction *exportMapAction_ = nullptr;
    QAction *copyNodeAction_ = nullptr;
    QAction *editNodeAction_ = nullptr;
    QAction *connectNodeAction_ = nullptr;
    QAction *updateRelationAction_ = nullptr;
    QAction *deleteNodeAction_ = nullptr;
    QAction *restoreNodeAction_ = nullptr;

    qint64 currentMapId_ = 0;
    qint64 currentNodeId_ = 0;
    QHash<qint64, MapRecord> maps_;
    QHash<qint64, NodeRecord> nodes_;
    QList<EdgeRecord> edges_;
    QHash<qint64, PendingGeneration> pendingGenerations_;
    QHash<qint64, PendingRelationGeneration> pendingRelationGenerations_;
    qint64 nextRelationRequestId_ = -1;
};
