#pragma once

#include "core/GraphTypes.h"

#include <QPair>
#include <QString>

struct TemplateContext {
    QString concept;
    QString selectedText;
    QString parentConcept;
    QString mapTitle;
    QString contextMarkdown;
    QString language;
};

class TemplateEngine {
public:
    QPair<QString, QString> render(const PromptTemplate &promptTemplate, const TemplateContext &context) const;

private:
    QString replaceVariables(QString text, const TemplateContext &context) const;
};

