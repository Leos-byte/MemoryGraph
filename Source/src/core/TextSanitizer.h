#pragma once

#include <QString>

namespace TextSanitizer {
QString stripTerminalSequences(QString text);
QString normalizeCodexMarkdown(QString markdown);
}
