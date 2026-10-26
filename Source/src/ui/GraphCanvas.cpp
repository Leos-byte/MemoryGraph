#include "ui/GraphCanvas.h"

#include "ui/GraphNodeItem.h"
#include "ui/UiTheme.h"

#include <QAction>
#include <QApplication>
#include <QGraphicsItem>
#include <QKeyEvent>
#include <QMenu>
#include <QMouseEvent>
#include <QPainter>
#include <QScrollBar>
#include <QTimer>
#include <QWheelEvent>
#include <QtGlobal>

#include <cmath>

GraphCanvas::GraphCanvas(QWidget *parent)
    : QGraphicsView(parent)
    , scene_(new QGraphicsScene(this))
{
    setScene(scene_);
    setRenderHint(QPainter::Antialiasing, true);
    setDragMode(QGraphicsView::RubberBandDrag);
    setTransformationAnchor(QGraphicsView::AnchorUnderMouse);
    setResizeAnchor(QGraphicsView::AnchorViewCenter);
    setFrameShape(QFrame::NoFrame);
    setViewportUpdateMode(QGraphicsView::SmartViewportUpdate);
    setFocusPolicy(Qt::StrongFocus);
    setAccessibleName(tr("Knowledge Graph Canvas"));
    scene_->setSceneRect(-2000, -2000, 4000, 4000);

    connect(scene_, &QGraphicsScene::selectionChanged, this, [this]() {
        emit currentNodeChanged(selectedNodeId());
    });
}

void GraphCanvas::setGraph(const QList<NodeRecord> &nodes, const QList<EdgeRecord> &edges)
{
    scene_->clear();
    nodeItems_.clear();
    edgeLines_.clear();
    edges_ = edges;

    for (const NodeRecord &node : nodes) {
        addOrUpdateNode(node);
    }

    for (int i = 0; i < edges_.size(); ++i) {
        QPen edgePen(UiTheme::color(UiTheme::ColorRole::Outline), 1.5);
        edgePen.setCosmetic(true);
        auto *line = scene_->addLine(QLineF(), edgePen);
        line->setZValue(-10);
        edgeLines_.append(line);
    }
    updateEdgeLines();
    if (!nodes.isEmpty()) {
        QTimer::singleShot(0, this, &GraphCanvas::fitGraph);
    }
}

void GraphCanvas::drawBackground(QPainter *painter, const QRectF &rect)
{
    painter->fillRect(rect, UiTheme::color(UiTheme::ColorRole::Canvas));

    constexpr qreal gridSize = 32.0;
    const qreal left = std::floor(rect.left() / gridSize) * gridSize;
    const qreal top = std::floor(rect.top() / gridSize) * gridSize;
    QVarLengthArray<QLineF, 256> lines;
    for (qreal x = left; x <= rect.right(); x += gridSize) {
        lines.append(QLineF(x, rect.top(), x, rect.bottom()));
    }
    for (qreal y = top; y <= rect.bottom(); y += gridSize) {
        lines.append(QLineF(rect.left(), y, rect.right(), y));
    }
    QPen gridPen(UiTheme::color(UiTheme::ColorRole::CanvasGrid), 1.0);
    gridPen.setCosmetic(true);
    painter->setPen(gridPen);
    painter->drawLines(lines.constData(), lines.size());
}

void GraphCanvas::keyPressEvent(QKeyEvent *event)
{
    if (event->key() == Qt::Key_Delete && selectedNodeId() > 0) {
        emit deleteNodeRequested(selectedNodeId());
        event->accept();
        return;
    }
    QGraphicsView::keyPressEvent(event);
}

void GraphCanvas::addOrUpdateNode(const NodeRecord &node)
{
    GraphNodeItem *item = nodeItems_.value(node.id, nullptr);
    if (!item) {
        item = new GraphNodeItem(node.id, node.title, node.status);
        scene_->addItem(item);
        nodeItems_.insert(node.id, item);
        connect(item, &GraphNodeItem::positionChanged, this, [this](qint64 nodeId, const QPointF &position) {
            updateEdgeLines();
            emit nodeMoved(nodeId, position);
        });
    }

    item->setTitle(node.title);
    item->setStatus(node.status);
    item->blockSignals(true);
    item->setPos(QPointF(node.x, node.y));
    item->blockSignals(false);
}

void GraphCanvas::selectNode(qint64 nodeId)
{
    scene_->clearSelection();
    if (GraphNodeItem *item = nodeItems_.value(nodeId, nullptr)) {
        item->setSelected(true);
        centerOn(item);
    }
}

qint64 GraphCanvas::selectedNodeId() const
{
    const QList<QGraphicsItem *> selected = scene_->selectedItems();
    if (selected.isEmpty()) {
        return 0;
    }
    auto *item = qgraphicsitem_cast<GraphNodeItem *>(selected.first());
    return item ? item->nodeId() : 0;
}

void GraphCanvas::fitGraph()
{
    if (nodeItems_.isEmpty()) {
        resetTransform();
        zoomLevel_ = 1.0;
        centerOn(QPointF(0, 0));
        return;
    }
    const QRectF bounds = scene_->itemsBoundingRect().adjusted(-32, -32, 32, 32);
    fitInView(bounds, Qt::KeepAspectRatio);
    if (transform().m11() < 0.72) {
        resetTransform();
        scale(0.72, 0.72);
        const qreal halfVisibleWidth = viewport()->width() / (2.0 * 0.72);
        centerOn(QPointF(bounds.left() + halfVisibleWidth, bounds.center().y()));
    } else if (transform().m11() > 1.25) {
        resetTransform();
        scale(1.25, 1.25);
        centerOn(bounds.center());
    }
    zoomLevel_ = transform().m11();
}

void GraphCanvas::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::RightButton) {
        rightButtonPressed_ = true;
        rightButtonPanning_ = false;
        rightPressViewPos_ = event->pos();
        lastPanViewPos_ = event->pos();
        rightPressScenePos_ = mapToScene(event->pos());

        GraphNodeItem *nodeItem = nodeItemAt(event->pos());
        rightPressNodeId_ = nodeItem != nullptr ? nodeItem->nodeId() : 0;
        scene_->clearSelection();
        if (nodeItem != nullptr) {
            nodeItem->setSelected(true);
        }

        event->accept();
        return;
    }

    QGraphicsView::mousePressEvent(event);
}

void GraphCanvas::mouseMoveEvent(QMouseEvent *event)
{
    if (rightButtonPressed_ && (event->buttons() & Qt::RightButton)) {
        const QPoint deltaFromPress = event->pos() - rightPressViewPos_;
        if (!rightButtonPanning_ && deltaFromPress.manhattanLength() >= QApplication::startDragDistance()) {
            rightButtonPanning_ = true;
            viewport()->setCursor(Qt::ClosedHandCursor);
        }

        if (rightButtonPanning_) {
            const QPoint delta = event->pos() - lastPanViewPos_;
            horizontalScrollBar()->setValue(horizontalScrollBar()->value() - delta.x());
            verticalScrollBar()->setValue(verticalScrollBar()->value() - delta.y());
            lastPanViewPos_ = event->pos();
        }

        event->accept();
        return;
    }

    QGraphicsView::mouseMoveEvent(event);
}

void GraphCanvas::mouseReleaseEvent(QMouseEvent *event)
{
    if (event->button() == Qt::RightButton && rightButtonPressed_) {
        const bool wasPanning = rightButtonPanning_;
        rightButtonPressed_ = false;
        rightButtonPanning_ = false;
        viewport()->unsetCursor();

        if (!wasPanning) {
            QMenu menu(this);
            QAction *newNodeAction = nullptr;
            QAction *deleteNodeAction = nullptr;

            if (rightPressNodeId_ > 0) {
                deleteNodeAction = menu.addAction(tr("Delete Node"));
            } else {
                newNodeAction = menu.addAction(tr("New Node Here"));
                menu.addAction(tr("Fit Map"), this, &GraphCanvas::fitGraph);
            }

#if QT_VERSION >= QT_VERSION_CHECK(6, 0, 0)
            const QPoint globalPos = event->globalPosition().toPoint();
#else
            const QPoint globalPos = event->globalPos();
#endif
            QAction *chosen = menu.exec(globalPos);
            if (chosen != nullptr && chosen == newNodeAction) {
                emit createNodeRequested(rightPressScenePos_);
            } else if (chosen != nullptr && chosen == deleteNodeAction) {
                emit deleteNodeRequested(rightPressNodeId_);
            }
        }

        rightPressNodeId_ = 0;
        event->accept();
        return;
    }

    QGraphicsView::mouseReleaseEvent(event);
}

void GraphCanvas::wheelEvent(QWheelEvent *event)
{
    const double factor = event->angleDelta().y() > 0 ? 1.12 : 1.0 / 1.12;
    const double nextZoom = zoomLevel_ * factor;
    if ((factor < 1.0 && nextZoom < 0.25) || (factor > 1.0 && nextZoom > 2.8)) {
        event->accept();
        return;
    }
    scale(factor, factor);
    zoomLevel_ = nextZoom;
    event->accept();
}

GraphNodeItem *GraphCanvas::nodeItemAt(const QPoint &viewPosition) const
{
    QGraphicsItem *rawItem = itemAt(viewPosition);
    while (rawItem != nullptr) {
        if (auto *nodeItem = qgraphicsitem_cast<GraphNodeItem *>(rawItem)) {
            return nodeItem;
        }
        rawItem = rawItem->parentItem();
    }
    return nullptr;
}

void GraphCanvas::updateEdgeLines()
{
    for (int i = 0; i < edges_.size() && i < edgeLines_.size(); ++i) {
        const QLineF line(itemCenter(edges_[i].sourceNodeId), itemCenter(edges_[i].targetNodeId));
        edgeLines_[i]->setLine(line);
    }
}

QPointF GraphCanvas::itemCenter(qint64 nodeId) const
{
    GraphNodeItem *item = nodeItems_.value(nodeId, nullptr);
    if (!item) {
        return {};
    }
    return item->sceneBoundingRect().center();
}
