#pragma once

#include "core/GraphTypes.h"

#include <QSettings>
#include <QString>

class AppSettings {
public:
    AppSettings();

    QString databasePath() const;
    QString dataDirectory() const;
    void setDataDirectory(const QString &value);

    QString baseUrl() const;
    void setBaseUrl(const QString &value);

    QString model() const;
    void setModel(const QString &value);

    AuthMode authMode() const;
    void setAuthMode(AuthMode mode);

    ApiMode apiMode() const;
    void setApiMode(ApiMode mode);

    QString uiLanguage() const;
    void setUiLanguage(const QString &value);

    bool autoGenerateLinkedNodes() const;
    void setAutoGenerateLinkedNodes(bool value);

private:
    QSettings settings_;
};
