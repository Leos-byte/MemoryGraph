#pragma once

#include "core/GraphStore.h"

#include <QCheckBox>
#include <QDialog>
#include <QLineEdit>
#include <QListWidget>
#include <QTextEdit>

class TemplateDialog : public QDialog {
    Q_OBJECT

public:
    explicit TemplateDialog(GraphStore *store, QWidget *parent = nullptr);

signals:
    void templatesChanged();

private:
    void reload();
    void showTemplate(qint64 templateId);
    PromptTemplate currentTemplate() const;
    bool validateTemplate(const PromptTemplate &promptTemplate, QString *message) const;

    GraphStore *store_ = nullptr;
    QListWidget *templateList_ = nullptr;
    QLineEdit *nameEdit_ = nullptr;
    QTextEdit *systemPromptEdit_ = nullptr;
    QTextEdit *userPromptEdit_ = nullptr;
    QCheckBox *defaultCheck_ = nullptr;
    qint64 currentTemplateId_ = 0;
};
