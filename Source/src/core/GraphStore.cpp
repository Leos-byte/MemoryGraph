#include "core/GraphStore.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QFile>
#include <QSqlError>
#include <QSqlQuery>
#include <QStringList>
#include <QVariant>

namespace {
QString nowIso()
{
    return QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);
}

QDateTime parseDate(const QVariant &value)
{
    return QDateTime::fromString(value.toString(), Qt::ISODateWithMs);
}

QString defaultSystemPrompt()
{
    return QString::fromUtf8(R"(You are MemGraph, a knowledge-learning assistant. Explain concepts for building a durable knowledge graph.

Rules:
- Output Markdown only.
- Be precise, concrete, and easy to review later.
- Explain in {{language}}.
- If the user selected text from a parent node, connect the new explanation to the parent concept.
- Do not invent citations. If uncertainty matters, state the uncertainty briefly.)");
}

QString defaultUserPrompt()
{
    return QString::fromUtf8(R"(Knowledge map: {{map_title}}
Parent concept: {{parent_concept}}
Selected text: {{selected_text}}
Target concept: {{concept}}

Existing context:
{{context_markdown}}

Please explain the target concept using this Markdown structure:

## 讲了什么
Explain what the concept means.

## 解决什么问题
Explain the scenarios or problems it helps solve.

## 组成部分或条件
List the important components, prerequisites, or conditions.

## 如果缺少这些部分会怎样
Explain what fails, becomes confusing, or changes if those components or conditions are missing.

## 和已有节点的联系
Explain how this concept connects to the parent concept or current knowledge map.)");
}
}

GraphStore::GraphStore(QObject *parent)
    : QObject(parent)
{
}

GraphStore::~GraphStore()
{
    close();
}

void GraphStore::close()
{
    const QString name = connectionName_;
    if (db_.isValid()) {
        db_.close();
    }
    db_ = QSqlDatabase();
    if (!name.isEmpty()) {
        QSqlDatabase::removeDatabase(name);
    }
    connectionName_.clear();
}

bool GraphStore::open(const QString &databasePath, QString *errorMessage)
{
    close();

    const QFileInfo info(databasePath);
    if (!info.absolutePath().isEmpty()) {
        QDir().mkpath(info.absolutePath());
    }

    for (const QString &suffix : {QString(), QStringLiteral("-wal"), QStringLiteral("-shm"), QStringLiteral("-journal")}) {
        const QString path = databasePath + suffix;
        if (QFileInfo::exists(path) && !QFile::setPermissions(path, QFileDevice::ReadOwner | QFileDevice::WriteOwner)) {
            if (errorMessage) {
                *errorMessage = tr("Unable to restrict database file permissions.");
            }
            return false;
        }
    }

    connectionName_ = QStringLiteral("memgraph_%1").arg(reinterpret_cast<quintptr>(this));
    db_ = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), connectionName_);
    db_.setDatabaseName(databasePath);

    if (!db_.open()) {
        if (errorMessage) {
            *errorMessage = db_.lastError().text();
        }
        return false;
    }

    if (!QFile::setPermissions(databasePath, QFileDevice::ReadOwner | QFileDevice::WriteOwner)) {
        if (errorMessage) {
            *errorMessage = tr("Unable to restrict database file permissions.");
        }
        close();
        return false;
    }

    QSqlQuery pragma(db_);
    pragma.exec(QStringLiteral("PRAGMA foreign_keys = ON"));

    return initializeSchema(errorMessage) && ensureDefaultTemplate(errorMessage);
}

QList<MapRecord> GraphStore::maps(QString *errorMessage) const
{
    QList<MapRecord> result;
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT id, title, description, deleted_at, created_at, updated_at FROM maps "
                                   "WHERE deleted_at = '' ORDER BY updated_at DESC, id DESC"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readMapRecord(query));
    }
    return result;
}

QList<MapRecord> GraphStore::deletedMaps(QString *errorMessage) const
{
    QList<MapRecord> result;
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT id, title, description, deleted_at, created_at, updated_at FROM maps "
                                   "WHERE deleted_at <> '' ORDER BY deleted_at DESC, id DESC"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readMapRecord(query));
    }
    return result;
}

MapRecord GraphStore::createMap(const QString &title, QString *errorMessage)
{
    const QString now = nowIso();
    const QString normalizedTitle = title.trimmed().isEmpty() ? tr("Untitled Map") : title.trimmed();
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("INSERT INTO maps(title, description, created_at, updated_at) VALUES(?, ?, ?, ?)"));
    query.addBindValue(normalizedTitle);
    query.addBindValue(QStringLiteral(""));
    query.addBindValue(now);
    query.addBindValue(now);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    return MapRecord{query.lastInsertId().toLongLong(),
                     normalizedTitle,
                     QString(),
                     {},
                     QDateTime::fromString(now, Qt::ISODateWithMs),
                     QDateTime::fromString(now, Qt::ISODateWithMs)};
}

bool GraphStore::updateMapTitle(qint64 mapId, const QString &title, QString *errorMessage)
{
    const QString normalizedTitle = title.trimmed().isEmpty() ? tr("Untitled Map") : title.trimmed();
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE maps SET title = ?, updated_at = ? WHERE id = ?"));
    query.addBindValue(normalizedTitle);
    query.addBindValue(nowIso());
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

bool GraphStore::deleteMap(qint64 mapId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE maps SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    const QString now = nowIso();
    query.addBindValue(now);
    query.addBindValue(now);
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

bool GraphStore::restoreMap(qint64 mapId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE maps SET deleted_at = '', updated_at = ? WHERE id = ? AND deleted_at <> ''"));
    query.addBindValue(nowIso());
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

bool GraphStore::permanentlyDeleteMap(qint64 mapId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("DELETE FROM maps WHERE id = ? AND deleted_at <> ''"));
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

QList<NodeRecord> GraphStore::nodes(qint64 mapId, QString *errorMessage) const
{
    QList<NodeRecord> result;
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("SELECT id, map_id, title, markdown, template_id, x, y, status, deleted_at, created_at, updated_at "
                                 "FROM nodes WHERE map_id = ? AND deleted_at = '' ORDER BY created_at ASC, id ASC"));
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readNodeRecord(query));
    }
    return result;
}

QList<NodeRecord> GraphStore::deletedNodes(qint64 mapId, QString *errorMessage) const
{
    QList<NodeRecord> result;
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("SELECT id, map_id, title, markdown, template_id, x, y, status, deleted_at, created_at, updated_at "
                                 "FROM nodes WHERE map_id = ? AND deleted_at <> '' ORDER BY deleted_at DESC, id DESC"));
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readNodeRecord(query));
    }
    return result;
}

QList<NodeRecord> GraphStore::deletedNodes(QString *errorMessage) const
{
    QList<NodeRecord> result;
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT n.id, n.map_id, n.title, n.markdown, n.template_id, n.x, n.y, n.status, n.deleted_at, n.created_at, n.updated_at "
                                   "FROM nodes n JOIN maps m ON m.id = n.map_id AND m.deleted_at = '' "
                                   "WHERE n.deleted_at <> '' ORDER BY n.deleted_at DESC, n.id DESC"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readNodeRecord(query));
    }
    return result;
}

NodeRecord GraphStore::node(qint64 nodeId, QString *errorMessage) const
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("SELECT id, map_id, title, markdown, template_id, x, y, status, deleted_at, created_at, updated_at FROM nodes WHERE id = ?"));
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    if (query.next()) {
        return readNodeRecord(query);
    }
    return {};
}

NodeRecord GraphStore::createNode(qint64 mapId,
                                  const QString &title,
                                  const QString &markdown,
                                  qint64 templateId,
                                  double x,
                                  double y,
                                  const QString &status,
                                  QString *errorMessage)
{
    const QString now = nowIso();
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("INSERT INTO nodes(map_id, title, markdown, template_id, x, y, status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"));
    query.addBindValue(mapId);
    query.addBindValue(title.trimmed());
    query.addBindValue(markdown);
    if (templateId > 0) {
        query.addBindValue(templateId);
    } else {
        query.addBindValue(QVariant());
    }
    query.addBindValue(x);
    query.addBindValue(y);
    query.addBindValue(status);
    query.addBindValue(now);
    query.addBindValue(now);

    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    return node(query.lastInsertId().toLongLong(), errorMessage);
}

bool GraphStore::updateNodeMarkdown(qint64 nodeId, const QString &markdown, const QString &status, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE nodes SET markdown = ?, status = ?, updated_at = ? WHERE id = ?"));
    query.addBindValue(markdown);
    query.addBindValue(status);
    query.addBindValue(nowIso());
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::updateNodeContent(qint64 nodeId, const QString &title, const QString &markdown, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE nodes SET title = ?, markdown = ?, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    query.addBindValue(title.trimmed().isEmpty() ? tr("Untitled Node") : title.trimmed());
    query.addBindValue(markdown);
    query.addBindValue(nowIso());
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::updateNodePosition(qint64 nodeId, double x, double y, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?"));
    query.addBindValue(x);
    query.addBindValue(y);
    query.addBindValue(nowIso());
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::deleteNode(qint64 nodeId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE nodes SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    const QString now = nowIso();
    query.addBindValue(now);
    query.addBindValue(now);
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::restoreNode(qint64 nodeId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE nodes SET status = 'ready', deleted_at = '', updated_at = ? WHERE id = ? AND deleted_at <> ''"));
    query.addBindValue(nowIso());
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::permanentlyDeleteNode(qint64 nodeId, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("DELETE FROM nodes WHERE id = ? AND deleted_at <> ''"));
    query.addBindValue(nodeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

bool GraphStore::emptyTrash(QString *errorMessage)
{
    if (!db_.transaction()) {
        if (errorMessage) {
            *errorMessage = lastErrorText();
        }
        return false;
    }

    QSqlQuery deleteNodes(db_);
    if (!deleteNodes.exec(QStringLiteral("DELETE FROM nodes WHERE deleted_at <> ''"))) {
        db_.rollback();
        if (errorMessage) {
            *errorMessage = deleteNodes.lastError().text();
        }
        return false;
    }

    QSqlQuery deleteMaps(db_);
    if (!deleteMaps.exec(QStringLiteral("DELETE FROM maps WHERE deleted_at <> ''"))) {
        db_.rollback();
        if (errorMessage) {
            *errorMessage = deleteMaps.lastError().text();
        }
        return false;
    }

    QSqlQuery deleteTemplates(db_);
    if (!deleteTemplates.exec(QStringLiteral("DELETE FROM templates WHERE deleted_at <> ''"))) {
        db_.rollback();
        if (errorMessage) {
            *errorMessage = deleteTemplates.lastError().text();
        }
        return false;
    }

    if (!db_.commit()) {
        if (errorMessage) {
            *errorMessage = lastErrorText();
        }
        return false;
    }
    return true;
}

QList<EdgeRecord> GraphStore::edges(qint64 mapId, QString *errorMessage) const
{
    QList<EdgeRecord> result;
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("SELECT e.id, e.map_id, e.source_node_id, e.target_node_id, e.type, e.label, e.created_at "
                                 "FROM edges e "
                                 "JOIN nodes s ON s.id = e.source_node_id AND s.deleted_at = '' "
                                 "JOIN nodes t ON t.id = e.target_node_id AND t.deleted_at = '' "
                                 "WHERE e.map_id = ? ORDER BY e.created_at ASC, e.id ASC"));
    query.addBindValue(mapId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readEdgeRecord(query));
    }
    return result;
}

EdgeRecord GraphStore::createEdge(qint64 mapId,
                                  qint64 sourceNodeId,
                                  qint64 targetNodeId,
                                  const QString &type,
                                  const QString &label,
                                  QString *errorMessage)
{
    if (sourceNodeId == targetNodeId) {
        if (errorMessage) {
            *errorMessage = tr("A node cannot connect to itself.");
        }
        return {};
    }

    QSqlQuery duplicate(db_);
    duplicate.prepare(QStringLiteral("SELECT id, map_id, source_node_id, target_node_id, type, label, created_at "
                                     "FROM edges WHERE map_id = ? AND source_node_id = ? AND target_node_id = ? LIMIT 1"));
    duplicate.addBindValue(mapId);
    duplicate.addBindValue(sourceNodeId);
    duplicate.addBindValue(targetNodeId);
    if (duplicate.exec() && duplicate.next()) {
        EdgeRecord existing = readEdgeRecord(duplicate);
        const QString normalizedLabel = label.trimmed();
        if (!normalizedLabel.isEmpty() && existing.label != normalizedLabel) {
            if (!updateEdgeLabel(existing.id, normalizedLabel, errorMessage)) {
                return {};
            }
            existing.label = normalizedLabel;
        }
        return existing;
    }

    QSqlQuery query(db_);
    query.prepare(QStringLiteral("INSERT INTO edges(map_id, source_node_id, target_node_id, type, label, created_at) VALUES(?, ?, ?, ?, ?, ?)"));
    query.addBindValue(mapId);
    query.addBindValue(sourceNodeId);
    query.addBindValue(targetNodeId);
    query.addBindValue(type);
    query.addBindValue(label);
    query.addBindValue(nowIso());
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    const qint64 id = query.lastInsertId().toLongLong();
    QSqlQuery read(db_);
    read.prepare(QStringLiteral("SELECT id, map_id, source_node_id, target_node_id, type, label, created_at FROM edges WHERE id = ?"));
    read.addBindValue(id);
    if (read.exec() && read.next()) {
        return readEdgeRecord(read);
    }
    return {};
}

bool GraphStore::updateEdgeLabel(qint64 edgeId, const QString &label, QString *errorMessage)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE edges SET label = ? WHERE id = ?"));
    query.addBindValue(label.trimmed());
    query.addBindValue(edgeId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

QList<PromptTemplate> GraphStore::templates(QString *errorMessage) const
{
    QList<PromptTemplate> result;
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT id, name, system_prompt, user_prompt, is_default, deleted_at, created_at, updated_at "
                                   "FROM templates WHERE deleted_at = '' ORDER BY is_default DESC, name ASC"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readTemplateRecord(query));
    }
    return result;
}

QList<PromptTemplate> GraphStore::deletedTemplates(QString *errorMessage) const
{
    QList<PromptTemplate> result;
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT id, name, system_prompt, user_prompt, is_default, deleted_at, created_at, updated_at "
                                   "FROM templates WHERE deleted_at <> '' ORDER BY deleted_at DESC, id DESC"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return result;
    }
    while (query.next()) {
        result.append(readTemplateRecord(query));
    }
    return result;
}

PromptTemplate GraphStore::promptTemplate(qint64 templateId, QString *errorMessage) const
{
    if (templateId <= 0) {
        return defaultTemplate(errorMessage);
    }

    QSqlQuery query(db_);
    query.prepare(QStringLiteral("SELECT id, name, system_prompt, user_prompt, is_default, deleted_at, created_at, updated_at "
                                 "FROM templates WHERE id = ? AND deleted_at = ''"));
    query.addBindValue(templateId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    if (query.next()) {
        return readTemplateRecord(query);
    }
    return {};
}

PromptTemplate GraphStore::defaultTemplate(QString *errorMessage) const
{
    QSqlQuery query(db_);
    if (!query.exec(QStringLiteral("SELECT id, name, system_prompt, user_prompt, is_default, deleted_at, created_at, updated_at "
                                   "FROM templates WHERE deleted_at = '' ORDER BY is_default DESC, id ASC LIMIT 1"))) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    if (query.next()) {
        return readTemplateRecord(query);
    }
    return {};
}

PromptTemplate GraphStore::createTemplate(const QString &name,
                                          const QString &systemPrompt,
                                          const QString &userPrompt,
                                          bool isDefault,
                                          QString *errorMessage)
{
    if (isDefault) {
        QSqlQuery clear(db_);
        clear.exec(QStringLiteral("UPDATE templates SET is_default = 0 WHERE deleted_at = ''"));
    }

    const QString now = nowIso();
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("INSERT INTO templates(name, system_prompt, user_prompt, is_default, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)"));
    query.addBindValue(name.trimmed().isEmpty() ? tr("New Template") : name.trimmed());
    query.addBindValue(systemPrompt);
    query.addBindValue(userPrompt);
    query.addBindValue(isDefault ? 1 : 0);
    query.addBindValue(now);
    query.addBindValue(now);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return {};
    }
    return promptTemplate(query.lastInsertId().toLongLong(), errorMessage);
}

bool GraphStore::updateTemplate(const PromptTemplate &promptTemplate, QString *errorMessage)
{
    if (promptTemplate.isDefault) {
        QSqlQuery clear(db_);
        clear.prepare(QStringLiteral("UPDATE templates SET is_default = 0 WHERE id <> ? AND deleted_at = ''"));
        clear.addBindValue(promptTemplate.id);
        clear.exec();
    }

    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE templates SET name = ?, system_prompt = ?, user_prompt = ?, is_default = ?, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    query.addBindValue(promptTemplate.name.trimmed().isEmpty() ? tr("New Template") : promptTemplate.name.trimmed());
    query.addBindValue(promptTemplate.systemPrompt);
    query.addBindValue(promptTemplate.userPrompt);
    query.addBindValue(promptTemplate.isDefault ? 1 : 0);
    query.addBindValue(nowIso());
    query.addBindValue(promptTemplate.id);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

bool GraphStore::deleteTemplate(qint64 templateId, QString *errorMessage)
{
    const QList<PromptTemplate> all = templates(errorMessage);
    if (all.size() <= 1) {
        if (errorMessage) {
            *errorMessage = tr("At least one template must remain.");
        }
        return false;
    }

    const PromptTemplate target = promptTemplate(templateId, errorMessage);
    if (target.id == 0) {
        if (errorMessage && errorMessage->isEmpty()) {
            *errorMessage = tr("Template not found.");
        }
        return false;
    }

    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE templates SET deleted_at = ?, is_default = 0, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    const QString now = nowIso();
    query.addBindValue(now);
    query.addBindValue(now);
    query.addBindValue(templateId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }

    if (target.isDefault) {
        const QList<PromptTemplate> remaining = templates();
        if (!remaining.isEmpty()) {
            setDefaultTemplate(remaining.first().id);
        }
    }
    return true;
}

bool GraphStore::restoreTemplate(qint64 templateId, QString *errorMessage)
{
    QSqlQuery count(db_);
    if (!count.exec(QStringLiteral("SELECT COUNT(*) FROM templates WHERE deleted_at = ''"))) {
        if (errorMessage) {
            *errorMessage = count.lastError().text();
        }
        return false;
    }
    const bool makeDefault = count.next() && count.value(0).toInt() == 0;

    QSqlQuery query(db_);
    query.prepare(QStringLiteral("UPDATE templates SET deleted_at = '', is_default = ?, updated_at = ? WHERE id = ? AND deleted_at <> ''"));
    query.addBindValue(makeDefault ? 1 : 0);
    query.addBindValue(nowIso());
    query.addBindValue(templateId);
    if (!query.exec()) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return query.numRowsAffected() > 0;
}

bool GraphStore::setDefaultTemplate(qint64 templateId, QString *errorMessage)
{
    if (!db_.transaction()) {
        if (errorMessage) {
            *errorMessage = lastErrorText();
        }
        return false;
    }

    QSqlQuery clear(db_);
    if (!clear.exec(QStringLiteral("UPDATE templates SET is_default = 0 WHERE deleted_at = ''"))) {
        db_.rollback();
        if (errorMessage) {
            *errorMessage = clear.lastError().text();
        }
        return false;
    }

    QSqlQuery setDefault(db_);
    setDefault.prepare(QStringLiteral("UPDATE templates SET is_default = 1, updated_at = ? WHERE id = ? AND deleted_at = ''"));
    setDefault.addBindValue(nowIso());
    setDefault.addBindValue(templateId);
    if (!setDefault.exec()) {
        db_.rollback();
        if (errorMessage) {
            *errorMessage = setDefault.lastError().text();
        }
        return false;
    }

    return db_.commit();
}

void GraphStore::recordGeneration(qint64 nodeId,
                                  const QString &model,
                                  ApiMode apiMode,
                                  const QString &promptSnapshot,
                                  const QString &status,
                                  const QString &errorText)
{
    QSqlQuery query(db_);
    query.prepare(QStringLiteral("INSERT INTO generation_history(node_id, model, api_mode, prompt_snapshot, status, error, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)"));
    query.addBindValue(nodeId);
    query.addBindValue(model);
    query.addBindValue(apiModeToString(apiMode));
    query.addBindValue(promptSnapshot);
    query.addBindValue(status);
    query.addBindValue(errorText);
    query.addBindValue(nowIso());
    query.exec();
}

bool GraphStore::initializeSchema(QString *errorMessage)
{
    const QStringList statements = {
        QStringLiteral("CREATE TABLE IF NOT EXISTS maps("
                       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                       "title TEXT NOT NULL,"
                       "description TEXT NOT NULL DEFAULT '',"
                       "deleted_at TEXT NOT NULL DEFAULT '',"
                       "created_at TEXT NOT NULL,"
                       "updated_at TEXT NOT NULL"
                       ")"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS templates("
                       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                       "name TEXT NOT NULL,"
                       "system_prompt TEXT NOT NULL,"
                       "user_prompt TEXT NOT NULL,"
                       "is_default INTEGER NOT NULL DEFAULT 0,"
                       "deleted_at TEXT NOT NULL DEFAULT '',"
                       "created_at TEXT NOT NULL,"
                       "updated_at TEXT NOT NULL"
                       ")"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS nodes("
                       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                       "map_id INTEGER NOT NULL,"
                       "title TEXT NOT NULL,"
                       "markdown TEXT NOT NULL DEFAULT '',"
                       "template_id INTEGER,"
                       "x REAL NOT NULL DEFAULT 0,"
                       "y REAL NOT NULL DEFAULT 0,"
                       "status TEXT NOT NULL DEFAULT 'ready',"
                       "deleted_at TEXT NOT NULL DEFAULT '',"
                       "created_at TEXT NOT NULL,"
                       "updated_at TEXT NOT NULL,"
                       "FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,"
                       "FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL"
                       ")"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS edges("
                       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                       "map_id INTEGER NOT NULL,"
                       "source_node_id INTEGER NOT NULL,"
                       "target_node_id INTEGER NOT NULL,"
                       "type TEXT NOT NULL DEFAULT 'explains',"
                       "label TEXT NOT NULL DEFAULT '',"
                       "created_at TEXT NOT NULL,"
                       "FOREIGN KEY(map_id) REFERENCES maps(id) ON DELETE CASCADE,"
                       "FOREIGN KEY(source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,"
                       "FOREIGN KEY(target_node_id) REFERENCES nodes(id) ON DELETE CASCADE"
                       ")"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS generation_history("
                       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                       "node_id INTEGER NOT NULL,"
                       "model TEXT NOT NULL,"
                       "api_mode TEXT NOT NULL,"
                       "prompt_snapshot TEXT NOT NULL,"
                       "status TEXT NOT NULL,"
                       "error TEXT NOT NULL DEFAULT '',"
                       "created_at TEXT NOT NULL,"
                       "FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE"
                       ")")
    };

    for (const QString &statement : statements) {
        if (!execStatement(statement, errorMessage)) {
            return false;
        }
    }
    if (!execStatement(QStringLiteral("ALTER TABLE nodes ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''"), nullptr)) {
        QSqlQuery check(db_);
        if (!check.exec(QStringLiteral("SELECT deleted_at FROM nodes LIMIT 1"))) {
            if (errorMessage) {
                *errorMessage = check.lastError().text();
            }
            return false;
        }
    }
    if (!execStatement(QStringLiteral("ALTER TABLE maps ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''"), nullptr)) {
        QSqlQuery check(db_);
        if (!check.exec(QStringLiteral("SELECT deleted_at FROM maps LIMIT 1"))) {
            if (errorMessage) {
                *errorMessage = check.lastError().text();
            }
            return false;
        }
    }
    if (!execStatement(QStringLiteral("ALTER TABLE templates ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''"), nullptr)) {
        QSqlQuery check(db_);
        if (!check.exec(QStringLiteral("SELECT deleted_at FROM templates LIMIT 1"))) {
            if (errorMessage) {
                *errorMessage = check.lastError().text();
            }
            return false;
        }
    }
    return true;
}

bool GraphStore::ensureDefaultTemplate(QString *errorMessage)
{
    QSqlQuery count(db_);
    if (!count.exec(QStringLiteral("SELECT COUNT(*) FROM templates WHERE deleted_at = ''"))) {
        if (errorMessage) {
            *errorMessage = count.lastError().text();
        }
        return false;
    }
    if (count.next() && count.value(0).toInt() > 0) {
        return true;
    }

    createTemplate(tr("Default Memory Explanation"), defaultSystemPrompt(), defaultUserPrompt(), true, errorMessage);
    return errorMessage == nullptr || errorMessage->isEmpty();
}

bool GraphStore::execStatement(const QString &sql, QString *errorMessage) const
{
    QSqlQuery query(db_);
    if (!query.exec(sql)) {
        if (errorMessage) {
            *errorMessage = query.lastError().text();
        }
        return false;
    }
    return true;
}

QString GraphStore::lastErrorText() const
{
    return db_.lastError().text();
}

MapRecord GraphStore::readMapRecord(const QSqlQuery &query) const
{
    MapRecord record;
    record.id = query.value(0).toLongLong();
    record.title = query.value(1).toString();
    record.description = query.value(2).toString();
    record.deletedAt = parseDate(query.value(3));
    record.createdAt = parseDate(query.value(4));
    record.updatedAt = parseDate(query.value(5));
    return record;
}

NodeRecord GraphStore::readNodeRecord(const QSqlQuery &query) const
{
    NodeRecord record;
    record.id = query.value(0).toLongLong();
    record.mapId = query.value(1).toLongLong();
    record.title = query.value(2).toString();
    record.markdown = query.value(3).toString();
    record.templateId = query.value(4).toLongLong();
    record.x = query.value(5).toDouble();
    record.y = query.value(6).toDouble();
    record.status = query.value(7).toString();
    record.deletedAt = parseDate(query.value(8));
    record.createdAt = parseDate(query.value(9));
    record.updatedAt = parseDate(query.value(10));
    return record;
}

EdgeRecord GraphStore::readEdgeRecord(const QSqlQuery &query) const
{
    EdgeRecord record;
    record.id = query.value(0).toLongLong();
    record.mapId = query.value(1).toLongLong();
    record.sourceNodeId = query.value(2).toLongLong();
    record.targetNodeId = query.value(3).toLongLong();
    record.type = query.value(4).toString();
    record.label = query.value(5).toString();
    record.createdAt = parseDate(query.value(6));
    return record;
}

PromptTemplate GraphStore::readTemplateRecord(const QSqlQuery &query) const
{
    PromptTemplate record;
    record.id = query.value(0).toLongLong();
    record.name = query.value(1).toString();
    record.systemPrompt = query.value(2).toString();
    record.userPrompt = query.value(3).toString();
    record.isDefault = query.value(4).toInt() != 0;
    record.deletedAt = parseDate(query.value(5));
    record.createdAt = parseDate(query.value(6));
    record.updatedAt = parseDate(query.value(7));
    return record;
}
