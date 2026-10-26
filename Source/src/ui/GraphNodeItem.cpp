#include "ui/GraphNodeItem.h"
#include "ui/UiTheme.h"

#include <QFontMetrics>
#include <QPainter>
#include <QStyleOptionGraphicsItem>
#include <QtGlobal>

GraphNodeItem::GraphNodeItem(qint64 nodeId, const QString &title, const QString &status, QGraphicsItem *parent)
    : QGraphicsObject(parent)
    , nodeId_(nodeId)
    , title_(title)
    , status_(status)
{
    setFlags(QGraphicsItem::ItemIsMovable
             | QGraphicsItem::ItemIsSelectable
             | QGraphicsItem::ItemSendsGeometryChanges);
    setAcceptHoverEvents(true);
}

QRectF GraphNodeItem::boundingRect() const
{
    return QRectF(0, 0, 210, 84);
}

void GraphNodeItem::paint(QPainter *painter, const QStyleOptionGraphicsItem *option, QWidget *)
{
    painter->setRenderHint(QPainter::Antialiasing, true);

    const bool hovered = option && (option->state & QStyle::State_MouseOver);
    const QColor fill = isSelected()
        ? UiTheme::color(UiTheme::ColorRole::SurfaceSelected)
        : UiTheme::color(UiTheme::ColorRole::Surface);
    const QColor border = (isSelected() || hovered)
        ? UiTheme::color(UiTheme::ColorRole::Interactive)
        : UiTheme::color(UiTheme::ColorRole::Outline);
    painter->setPen(QPen(border, isSelected() ? 2.0 : 1.2));
    painter->setBrush(fill);
    painter->drawRoundedRect(boundingRect().adjusted(1, 1, -1, -1), 6, 6);

    const QRectF titleRect = boundingRect().adjusted(14, 10, -14, -32);
    QFont titleFont = painter->font();
    titleFont.setPointSize(qMax(16, titleFont.pointSize()));
    titleFont.setWeight(QFont::DemiBold);
    painter->setFont(titleFont);
    painter->setPen(UiTheme::color(UiTheme::ColorRole::Text));
    const QString title = QFontMetrics(titleFont).elidedText(title_, Qt::ElideRight, static_cast<int>(titleRect.width()));
    painter->drawText(titleRect, Qt::AlignLeft | Qt::AlignVCenter, title);

    QFont statusFont = painter->font();
    statusFont.setWeight(QFont::Normal);
    const int basePointSize = statusFont.pointSize() > 0 ? statusFont.pointSize() : 10;
    statusFont.setPointSize(qMax(9, basePointSize - 2));
    painter->setFont(statusFont);

    QColor statusColor = UiTheme::color(UiTheme::ColorRole::Success);
    QString statusText = tr("Ready");
    if (status_ == QStringLiteral("generating")) {
        statusColor = UiTheme::color(UiTheme::ColorRole::Warning);
        statusText = tr("Generating");
    } else if (status_ == QStringLiteral("error")) {
        statusColor = UiTheme::color(UiTheme::ColorRole::Error);
        statusText = tr("Error");
    }
    painter->setPen(Qt::NoPen);
    painter->setBrush(statusColor);
    painter->drawEllipse(QPointF(17, 65), 4, 4);
    painter->setPen(UiTheme::color(UiTheme::ColorRole::TextMuted));
    painter->drawText(QRectF(29, 52, 165, 25), Qt::AlignLeft | Qt::AlignVCenter, statusText);
}

qint64 GraphNodeItem::nodeId() const
{
    return nodeId_;
}

void GraphNodeItem::setTitle(const QString &title)
{
    title_ = title;
    update();
}

void GraphNodeItem::setStatus(const QString &status)
{
    status_ = status;
    update();
}

QVariant GraphNodeItem::itemChange(GraphicsItemChange change, const QVariant &value)
{
    if (change == QGraphicsItem::ItemPositionHasChanged) {
        emit positionChanged(nodeId_, pos());
    }
    return QGraphicsObject::itemChange(change, value);
}
