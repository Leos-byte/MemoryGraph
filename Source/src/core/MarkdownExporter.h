#pragma once

#include "core/GraphTypes.h"

#include <QList>
#include <QString>

class MarkdownExporter {
public:
    QString exportNode(const NodeRecord &node) const;
    QString exportMap(const MapRecord &map, const QList<NodeRecord> &nodes, const QList<EdgeRecord> &edges) const;

private:
    QString headerForDepth(int depth) const;
};

