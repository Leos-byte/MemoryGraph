#include "core/TextSanitizer.h"

#include <QRegularExpression>

namespace {
bool isUnstableDisplayCodePoint(uint codePoint)
{
    return codePoint == 0x200D
        || codePoint == 0x20E3
        || codePoint == 0xFFFD
        || (codePoint >= 0x80 && codePoint <= 0x9F)
        || (codePoint >= 0xE000 && codePoint <= 0xF8FF)
        || (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
        || (codePoint >= 0x2600 && codePoint <= 0x27BF)
        || (codePoint >= 0x1F000 && codePoint <= 0x1FAFF)
        || (codePoint >= 0xE0100 && codePoint <= 0xE01EF);
}

QString withoutInvalidControls(const QString &text)
{
    QString cleaned;
    cleaned.reserve(text.size());
    const QVector<uint> codePoints = text.toUcs4();
    for (uint codePoint : codePoints) {
        const bool invalidControl = codePoint < 0x20
            && codePoint != '\n'
            && codePoint != '\t';
        if (invalidControl || (codePoint >= 0x7F && codePoint <= 0x9F)) {
            continue;
        }
        if (codePoint <= 0xFFFF) {
            cleaned.append(QChar(static_cast<ushort>(codePoint)));
        } else {
            cleaned.append(QChar(QChar::highSurrogate(codePoint)));
            cleaned.append(QChar(QChar::lowSurrogate(codePoint)));
        }
    }
    return cleaned;
}
}

QString TextSanitizer::stripTerminalSequences(QString text)
{
    static const QRegularExpression ansiCsi(
        QStringLiteral("\\x1B\\[[0-?]*[ -/]*[@-~]"));
    static const QRegularExpression ansiOsc(
        QStringLiteral("\\x1B\\][^\\x07]*(?:\\x07|\\x1B\\\\)"));
    static const QRegularExpression trailingCsi(
        QStringLiteral("\\x1B\\[[0-?]*[ -/]*$"));
    static const QRegularExpression trailingOsc(
        QStringLiteral("\\x1B\\][^\\x07]*$"));

    text.remove(ansiCsi);
    text.remove(ansiOsc);
    text.remove(trailingCsi);
    text.remove(trailingOsc);
    text.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
    text.replace(QLatin1Char('\r'), QLatin1Char('\n'));
    return withoutInvalidControls(text);
}

QString TextSanitizer::normalizeCodexMarkdown(QString markdown)
{
    markdown = stripTerminalSequences(markdown);
    markdown.remove(QChar::ByteOrderMark);
    markdown.replace(QChar(0x2190), QStringLiteral("<-"));
    markdown.replace(QChar(0x2192), QStringLiteral("->"));
    markdown.replace(QChar(0x2193), QStringLiteral("|"));
    markdown.replace(QChar(0x2194), QStringLiteral("<->"));
    markdown.replace(QChar(0x21D0), QStringLiteral("<="));
    markdown.replace(QChar(0x21D2), QStringLiteral("=>"));
    markdown.replace(QChar(0x21D4), QStringLiteral("<=>"));

    QString normalized;
    normalized.reserve(markdown.size());
    const QVector<uint> codePoints = markdown.toUcs4();
    for (uint codePoint : codePoints) {
        if (isUnstableDisplayCodePoint(codePoint)) {
            continue;
        }
        if (codePoint <= 0xFFFF) {
            normalized.append(QChar(static_cast<ushort>(codePoint)));
        } else {
            normalized.append(QChar(QChar::highSurrogate(codePoint)));
            normalized.append(QChar(QChar::lowSurrogate(codePoint)));
        }
    }
    return normalized.trimmed();
}
