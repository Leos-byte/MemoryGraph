#include "core/MarkdownExporter.h"

#include <QHash>
#include <QSet>
#include <QStringList>
#include <QtGlobal>

#include <functional>

QString MarkdownExporter::exportNode(const NodeRecord &node) const
{
    QString out;
    out += QStringLiteral("# ") + node.title + QStringLiteral("\n\n");
    out += node.markdown.trimmed();
    out += QStringLiteral("\n");
    return out;
}

QString MarkdownExporter::exportMap(const MapRecord &map, const QList<NodeRecord> &nodes, const QList<EdgeRecord> &edges) const
{
    QHash<qint64, NodeRecord> nodeById;
    QHash<qint64, QList<EdgeRecord>> childrenBySource;
    QSet<qint64> targeted;

    for (const NodeRecord &node : nodes) {
        nodeById.insert(node.id, node);
    }
    for (const EdgeRecord &edge : edges) {
        childrenBySource[edge.sourceNodeId].append(edge);
        targeted.insert(edge.targetNodeId);
    }

    QList<qint64> roots;
    for (const NodeRecord &node : nodes) {
        if (!targeted.contains(node.id)) {
            roots.append(node.id);
        }
    }
    if (roots.isEmpty()) {
        for (const NodeRecord &node : nodes) {
            roots.append(node.id);
        }
    }

    QString out;
    out += QStringLiteral("# ") + map.title + QStringLiteral("\n\n");
    if (!map.description.trimmed().isEmpty()) {
        out += map.description.trimmed() + QStringLiteral("\n\n");
    }

    QSet<qint64> visited;
    std::function<void(qint64, int)> writeNode = [&](qint64 nodeId, int depth) {
        if (!nodeById.contains(nodeId)) {
            return;
        }
        const NodeRecord node = nodeById.value(nodeId);
        if (visited.contains(nodeId)) {
            out += QStringLiteral("- Reused node: [") + node.title + QStringLiteral("](#node-")
                + QString::number(node.id) + QStringLiteral(")\n\n");
            return;
        }
        visited.insert(nodeId);

        out += QStringLiteral("<a id=\"node-") + QString::number(node.id) + QStringLiteral("\"></a>\n\n");
        out += headerForDepth(depth) + QStringLiteral(" ") + node.title + QStringLiteral("\n\n");
        if (!node.markdown.trimmed().isEmpty()) {
            out += node.markdown.trimmed() + QStringLiteral("\n\n");
        }

        for (const EdgeRecord &edge : childrenBySource.value(nodeId)) {
            writeNode(edge.targetNodeId, depth + 1);
        }
    };

    for (qint64 rootId : roots) {
        writeNode(rootId, 2);
    }

    return out;
}

QString MarkdownExporter::headerForDepth(int depth) const
{
    const int safeDepth = qBound(1, depth, 6);
    return QString(safeDepth, QLatin1Char('#'));
}
