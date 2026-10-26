#pragma once

#include <QGraphicsObject>
#include <QString>

class GraphNodeItem : public QGraphicsObject {
    Q_OBJECT

public:
    explicit GraphNodeItem(qint64 nodeId, const QString &title, const QString &status, QGraphicsItem *parent = nullptr);

    QRectF boundingRect() const override;
    void paint(QPainter *painter, const QStyleOptionGraphicsItem *option, QWidget *widget = nullptr) override;

    qint64 nodeId() const;
    void setTitle(const QString &title);
    void setStatus(const QString &status);

signals:
    void positionChanged(qint64 nodeId, const QPointF &position);

protected:
    QVariant itemChange(GraphicsItemChange change, const QVariant &value) override;

private:
    qint64 nodeId_ = 0;
    QString title_;
    QString status_;
};

