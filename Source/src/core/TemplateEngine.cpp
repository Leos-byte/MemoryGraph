#include "core/TemplateEngine.h"
#include <QHash>
#include <QRegularExpression>

QPair<QString, QString> TemplateEngine::render(const PromptTemplate &promptTemplate, const TemplateContext &context) const
{
    return {replaceVariables(promptTemplate.systemPrompt, context),
            replaceVariables(promptTemplate.userPrompt, context)};
}

QString TemplateEngine::replaceVariables(QString text, const TemplateContext &context) const
{
    const QHash<QString, QString> values{
        {QStringLiteral("concept"), context.concept},
        {QStringLiteral("selected_text"), context.selectedText},
        {QStringLiteral("parent_concept"), context.parentConcept},
        {QStringLiteral("map_title"), context.mapTitle},
        {QStringLiteral("context_markdown"), context.contextMarkdown},
        {QStringLiteral("language"), context.language}
    };
    static const QRegularExpression variable(QStringLiteral("\\{\\{(concept|selected_text|parent_concept|map_title|context_markdown|language)\\}\\}"));
    QString result;
    qsizetype offset = 0;
    auto matches = variable.globalMatch(text);
    while (matches.hasNext()) {
        const auto match = matches.next();
        result += text.mid(offset, match.capturedStart() - offset);
        result += values.value(match.captured(1));
        offset = match.capturedEnd();
    }
    result += text.mid(offset);
    return result;
}

