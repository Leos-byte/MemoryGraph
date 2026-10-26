#pragma once

#include "core/GraphTypes.h"

#include <QGraphicsLineItem>
#include <QGraphicsScene>
#include <QGraphicsView>
#include <QHash>

class GraphNodeItem;

class GraphCanvas : public QGraphicsView {
    Q_OBJECT

public:
    explicit GraphCanvas(QWidget *parent = nullptr);

    void setGraph(const QList<NodeRecord> &nodes, const QList<EdgeRecord> &edges);
    void addOrUpdateNode(const NodeRecord &node);
    void selectNode(qint64 nodeId);
    void fitGraph();
    qint64 selectedNodeId() const;

signals:
    void currentNodeChanged(qint64 nodeId);
    void nodeMoved(qint64 nodeId, const QPointF &position);
    void createNodeRequested(const QPointF &scenePosition);
    void deleteNodeRequested(qint64 nodeId);

protected:
    void drawBackground(QPainter *painter, const QRectF &rect) override;
    void keyPressEvent(QKeyEvent *event) override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void wheelEvent(QWheelEvent *event) override;

private:
    GraphNodeItem *nodeItemAt(const QPoint &viewPosition) const;
    void updateEdgeLines();
    QPointF itemCenter(qint64 nodeId) const;

    QGraphicsScene *scene_ = nullptr;
    QHash<qint64, GraphNodeItem *> nodeItems_;
    QList<EdgeRecord> edges_;
    QList<QGraphicsLineItem *> edgeLines_;
    bool rightButtonPressed_ = false;
    bool rightButtonPanning_ = false;
    QPoint rightPressViewPos_;
    QPoint lastPanViewPos_;
    QPointF rightPressScenePos_;
    qint64 rightPressNodeId_ = 0;
    double zoomLevel_ = 1.0;
};
