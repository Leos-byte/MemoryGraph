#pragma once

#include <QColor>
#include <QIcon>
#include <QString>
#include <QStyle>

class QApplication;

namespace UiTheme {
enum class ColorRole {
    Canvas,
    CanvasGrid,
    Surface,
    SurfaceSelected,
    Text,
    TextMuted,
    Outline,
    Interactive,
    Success,
    Warning,
    Error
};

void apply(QApplication &application);
QColor color(ColorRole role);
QIcon icon(const QString &themeName, QStyle::StandardPixmap fallback);
}
