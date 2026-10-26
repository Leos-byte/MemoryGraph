#include "ui/UiTheme.h"

#include <QApplication>
#include <QFont>
#include <QPalette>
#include <QStyleFactory>

namespace {
struct ThemeColors {
    QString window;
    QString surface;
    QString surfaceAlt;
    QString surfaceSelected;
    QString text;
    QString textMuted;
    QString outline;
    QString outlineStrong;
    QString interactive;
    QString interactiveHover;
    QString interactivePressed;
    QString onInteractive;
    QString success;
    QString warning;
    QString error;
    QString errorSurface;
    QString canvas;
    QString canvasGrid;
};

bool darkTheme = false;

ThemeColors colors(bool dark)
{
    if (dark) {
        return {
            QStringLiteral("#151918"), QStringLiteral("#1D2221"), QStringLiteral("#252B29"),
            QStringLiteral("#153A35"), QStringLiteral("#F2F5F4"), QStringLiteral("#AEB9B5"),
            QStringLiteral("#3C4743"), QStringLiteral("#65736E"), QStringLiteral("#37C7B5"),
            QStringLiteral("#52D4C3"), QStringLiteral("#249D90"), QStringLiteral("#09201D"),
            QStringLiteral("#61C995"), QStringLiteral("#E2B65C"), QStringLiteral("#FF8D87"),
            QStringLiteral("#442724"), QStringLiteral("#111514"), QStringLiteral("#29322F")
        };
    }
    return {
        QStringLiteral("#F3F6F5"), QStringLiteral("#FFFFFF"), QStringLiteral("#F7F9F8"),
        QStringLiteral("#E3F3F0"), QStringLiteral("#18221F"), QStringLiteral("#66736F"),
        QStringLiteral("#D6DEDB"), QStringLiteral("#9BA9A4"), QStringLiteral("#0F766E"),
        QStringLiteral("#0B685F"), QStringLiteral("#095950"), QStringLiteral("#FFFFFF"),
        QStringLiteral("#26734D"), QStringLiteral("#A06413"), QStringLiteral("#B42318"),
        QStringLiteral("#FDECEA"), QStringLiteral("#F8FAF9"), QStringLiteral("#E2E8E5")
    };
}

QString themedStyleSheet(const ThemeColors &c)
{
    QString style = QStringLiteral(R"QSS(
QWidget {
    color: $text$;
    font-size: 12pt;
    letter-spacing: 0px;
}
QMainWindow, QDialog { background: $window$; }
QFrame[role="sidePanel"] { background: $surface$; border: 0; }
QFrame[role="separator"] { background: $outline$; border: 0; max-height: 1px; }
QLabel[role="title"] { font-size: 15pt; font-weight: 600; color: $text$; }
QLabel[role="sectionTitle"] { font-size: 13pt; font-weight: 600; color: $text$; }
QLabel[role="muted"] { color: $textMuted$; }
QLabel[role="statusSuccess"] { color: $success$; font-weight: 600; }
QLabel[role="statusError"] { color: $error$; font-weight: 600; }

QPushButton, QToolButton {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid $outline$;
    border-radius: 6px;
    background: $surface$;
    color: $text$;
}
QToolButton { padding: 0 8px; }
QPushButton:hover, QToolButton:hover { background: $surfaceAlt$; border-color: $outlineStrong$; }
QPushButton:pressed, QToolButton:pressed { background: $surfaceSelected$; }
QPushButton:focus, QToolButton:focus { border: 2px solid $interactive$; }
QPushButton:disabled, QToolButton:disabled { color: $textMuted$; background: $surfaceAlt$; border-color: $outline$; }
QPushButton[variant="primary"], QToolButton[variant="primary"] {
    background: $interactive$;
    border-color: $interactive$;
    color: $onInteractive$;
    font-weight: 600;
}
QPushButton[variant="primary"]:hover, QToolButton[variant="primary"]:hover {
    background: $interactiveHover$;
    border-color: $interactiveHover$;
}
QPushButton[variant="primary"]:pressed, QToolButton[variant="primary"]:pressed {
    background: $interactivePressed$;
}
QPushButton[variant="primary"]:disabled, QToolButton[variant="primary"]:disabled {
    color: $textMuted$;
    background: $surfaceAlt$;
    border-color: $outline$;
}
QPushButton[variant="danger"], QToolButton[variant="danger"] {
    color: $error$;
    background: $errorSurface$;
    border-color: $error$;
}

QLineEdit, QComboBox, QTextEdit, QTextBrowser, QListWidget, QTreeWidget {
    background: $surface$;
    color: $text$;
    border: 1px solid $outline$;
    border-radius: 6px;
    selection-background-color: $interactive$;
    selection-color: $onInteractive$;
}
QLineEdit, QComboBox { min-height: 36px; padding: 0 9px; }
QTextEdit, QTextBrowser { padding: 10px; }
QLineEdit:focus, QComboBox:focus, QTextEdit:focus, QTextBrowser:focus, QListWidget:focus {
    border: 2px solid $interactive$;
}
QComboBox::drop-down { border: 0; width: 28px; }
QComboBox QAbstractItemView { padding: 4px; border: 1px solid $outlineStrong$; }
QListWidget { outline: 0; padding: 4px; }
QListWidget::item { min-height: 34px; padding: 4px 8px; border-radius: 4px; }
QListWidget::item:hover { background: $surfaceAlt$; }
QListWidget::item:selected { background: $surfaceSelected$; color: $text$; }

QGroupBox {
    margin-top: 16px;
    padding: 16px 12px 12px 12px;
    border: 1px solid $outline$;
    border-radius: 6px;
    background: $surface$;
    font-weight: 600;
}
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 6px; color: $text$; }
QCheckBox { spacing: 8px; }
QCheckBox::indicator { width: 18px; height: 18px; }

QMenuBar { background: $surface$; border-bottom: 1px solid $outline$; padding: 3px; }
QMenuBar::item { padding: 7px 10px; border-radius: 4px; }
QMenuBar::item:selected { background: $surfaceSelected$; }
QMenu { background: $surface$; border: 1px solid $outlineStrong$; padding: 5px; }
QMenu::item { padding: 8px 28px 8px 10px; border-radius: 4px; }
QMenu::item:selected { background: $surfaceSelected$; }
QMenu::separator { height: 1px; background: $outline$; margin: 5px 8px; }

QSplitter::handle { background: $outline$; }
QSplitter::handle:horizontal { width: 1px; }
QStatusBar { background: $surface$; border-top: 1px solid $outline$; color: $textMuted$; }
QStatusBar::item { border: 0; }
QScrollArea { border: 0; background: transparent; }
QScrollBar:vertical { width: 12px; background: transparent; margin: 2px; }
QScrollBar:horizontal { height: 12px; background: transparent; margin: 2px; }
QScrollBar::handle { background: $outlineStrong$; border-radius: 5px; min-height: 28px; min-width: 28px; }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QToolTip { background: $text$; color: $surface$; border: 0; padding: 5px; }
)QSS");

    const QList<QPair<QString, QString>> tokens{
        {QStringLiteral("$interactivePressed$"), c.interactivePressed},
        {QStringLiteral("$interactiveHover$"), c.interactiveHover},
        {QStringLiteral("$surfaceSelected$"), c.surfaceSelected},
        {QStringLiteral("$outlineStrong$"), c.outlineStrong},
        {QStringLiteral("$onInteractive$"), c.onInteractive},
        {QStringLiteral("$interactive$"), c.interactive},
        {QStringLiteral("$errorSurface$"), c.errorSurface},
        {QStringLiteral("$surfaceAlt$"), c.surfaceAlt},
        {QStringLiteral("$canvasGrid$"), c.canvasGrid},
        {QStringLiteral("$textMuted$"), c.textMuted},
        {QStringLiteral("$success$"), c.success},
        {QStringLiteral("$warning$"), c.warning},
        {QStringLiteral("$surface$"), c.surface},
        {QStringLiteral("$outline$"), c.outline},
        {QStringLiteral("$window$"), c.window},
        {QStringLiteral("$canvas$"), c.canvas},
        {QStringLiteral("$error$"), c.error},
        {QStringLiteral("$text$"), c.text}
    };
    for (const auto &token : tokens) {
        style.replace(token.first, token.second);
    }
    return style;
}
}

void UiTheme::apply(QApplication &application)
{
    darkTheme = application.palette().color(QPalette::Window).lightness() < 128;
    application.setStyle(QStyleFactory::create(QStringLiteral("Fusion")));
    const ThemeColors c = colors(darkTheme);

    QPalette palette;
    palette.setColor(QPalette::Window, QColor(c.window));
    palette.setColor(QPalette::WindowText, QColor(c.text));
    palette.setColor(QPalette::Base, QColor(c.surface));
    palette.setColor(QPalette::AlternateBase, QColor(c.surfaceAlt));
    palette.setColor(QPalette::Text, QColor(c.text));
    palette.setColor(QPalette::Button, QColor(c.surface));
    palette.setColor(QPalette::ButtonText, QColor(c.text));
    palette.setColor(QPalette::Highlight, QColor(c.interactive));
    palette.setColor(QPalette::HighlightedText, QColor(c.onInteractive));
    palette.setColor(QPalette::ToolTipBase, QColor(c.text));
    palette.setColor(QPalette::ToolTipText, QColor(c.surface));
    palette.setColor(QPalette::Disabled, QPalette::Text, QColor(c.textMuted));
    palette.setColor(QPalette::Disabled, QPalette::ButtonText, QColor(c.textMuted));
    application.setPalette(palette);

    QFont font = application.font();
    if (font.pointSize() < 12) {
        font.setPointSize(12);
    }
    application.setFont(font);
    application.setStyleSheet(themedStyleSheet(c));
}

QColor UiTheme::color(ColorRole role)
{
    const ThemeColors c = colors(darkTheme);
    switch (role) {
    case ColorRole::Canvas: return QColor(c.canvas);
    case ColorRole::CanvasGrid: return QColor(c.canvasGrid);
    case ColorRole::Surface: return QColor(c.surface);
    case ColorRole::SurfaceSelected: return QColor(c.surfaceSelected);
    case ColorRole::Text: return QColor(c.text);
    case ColorRole::TextMuted: return QColor(c.textMuted);
    case ColorRole::Outline: return QColor(c.outlineStrong);
    case ColorRole::Interactive: return QColor(c.interactive);
    case ColorRole::Success: return QColor(c.success);
    case ColorRole::Warning: return QColor(c.warning);
    case ColorRole::Error: return QColor(c.error);
    }
    return QColor(c.text);
}

QIcon UiTheme::icon(const QString &themeName, QStyle::StandardPixmap fallback)
{
    const QIcon themed = QIcon::fromTheme(themeName);
    return themed.isNull() ? QApplication::style()->standardIcon(fallback) : themed;
}
