#pragma once

#include "core/GraphTypes.h"

#include <QList>
#include <QObject>
#include <QSqlDatabase>
#include <QString>

class GraphStore : public QObject {
    Q_OBJECT

public:
    explicit GraphStore(QObject *parent = nullptr);
    ~GraphStore() override;

    bool open(const QString &databasePath, QString *errorMessage = nullptr);
    void close();

    QList<MapRecord> maps(QString *errorMessage = nullptr) const;
    QList<MapRecord> deletedMaps(QString *errorMessage = nullptr) const;
    MapRecord createMap(const QString &title, QString *errorMessage = nullptr);
    bool updateMapTitle(qint64 mapId, const QString &title, QString *errorMessage = nullptr);
    bool deleteMap(qint64 mapId, QString *errorMessage = nullptr);
    bool restoreMap(qint64 mapId, QString *errorMessage = nullptr);
    bool permanentlyDeleteMap(qint64 mapId, QString *errorMessage = nullptr);

    QList<NodeRecord> nodes(qint64 mapId, QString *errorMessage = nullptr) const;
    QList<NodeRecord> deletedNodes(qint64 mapId, QString *errorMessage = nullptr) const;
    QList<NodeRecord> deletedNodes(QString *errorMessage = nullptr) const;
    NodeRecord node(qint64 nodeId, QString *errorMessage = nullptr) const;
    NodeRecord createNode(qint64 mapId,
                          const QString &title,
                          const QString &markdown,
                          qint64 templateId,
                          double x,
                          double y,
                          const QString &status,
                          QString *errorMessage = nullptr);
    bool updateNodeMarkdown(qint64 nodeId, const QString &markdown, const QString &status, QString *errorMessage = nullptr);
    bool updateNodeContent(qint64 nodeId, const QString &title, const QString &markdown, QString *errorMessage = nullptr);
    bool updateNodePosition(qint64 nodeId, double x, double y, QString *errorMessage = nullptr);
    bool deleteNode(qint64 nodeId, QString *errorMessage = nullptr);
    bool restoreNode(qint64 nodeId, QString *errorMessage = nullptr);
    bool permanentlyDeleteNode(qint64 nodeId, QString *errorMessage = nullptr);
    bool emptyTrash(QString *errorMessage = nullptr);

    QList<EdgeRecord> edges(qint64 mapId, QString *errorMessage = nullptr) const;
    EdgeRecord createEdge(qint64 mapId,
                          qint64 sourceNodeId,
                          qint64 targetNodeId,
                          const QString &type,
                          const QString &label,
                          QString *errorMessage = nullptr);
    bool updateEdgeLabel(qint64 edgeId, const QString &label, QString *errorMessage = nullptr);

    QList<PromptTemplate> templates(QString *errorMessage = nullptr) const;
    QList<PromptTemplate> deletedTemplates(QString *errorMessage = nullptr) const;
    PromptTemplate promptTemplate(qint64 templateId, QString *errorMessage = nullptr) const;
    PromptTemplate defaultTemplate(QString *errorMessage = nullptr) const;
    PromptTemplate createTemplate(const QString &name,
                                  const QString &systemPrompt,
                                  const QString &userPrompt,
                                  bool isDefault,
                                  QString *errorMessage = nullptr);
    bool updateTemplate(const PromptTemplate &promptTemplate, QString *errorMessage = nullptr);
    bool deleteTemplate(qint64 templateId, QString *errorMessage = nullptr);
    bool restoreTemplate(qint64 templateId, QString *errorMessage = nullptr);
    bool setDefaultTemplate(qint64 templateId, QString *errorMessage = nullptr);

    void recordGeneration(qint64 nodeId,
                          const QString &model,
                          ApiMode apiMode,
                          const QString &promptSnapshot,
                          const QString &status,
                          const QString &errorText = QString());

private:
    bool initializeSchema(QString *errorMessage);
    bool ensureDefaultTemplate(QString *errorMessage);
    bool execStatement(const QString &sql, QString *errorMessage) const;
    QString lastErrorText() const;

    MapRecord readMapRecord(const QSqlQuery &query) const;
    NodeRecord readNodeRecord(const QSqlQuery &query) const;
    EdgeRecord readEdgeRecord(const QSqlQuery &query) const;
    PromptTemplate readTemplateRecord(const QSqlQuery &query) const;

    QString connectionName_;
    QSqlDatabase db_;
};
