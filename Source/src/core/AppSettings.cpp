#include "core/AppSettings.h"

#include <QDir>
#include <QFileInfo>
#include <QStandardPaths>

namespace {
constexpr auto kDefaultBaseUrl = "https://api.openai.com";
constexpr auto kDefaultModel = "gpt-5.6-terra";
}

AppSettings::AppSettings()
    : settings_(QStringLiteral("MemGraph"), QStringLiteral("MemGraph"))
{
}

QString AppSettings::databasePath() const
{
    return dataDirectory() + QStringLiteral("/memgraph.sqlite3");
}

QString AppSettings::dataDirectory() const
{
    const QString configured = settings_.value(QStringLiteral("database/directory")).toString();
    if (!configured.isEmpty()) {
        QDir().mkpath(configured);
        return configured;
    }
    const QString legacyDatabasePath = settings_.value(QStringLiteral("database/path")).toString();
    if (!legacyDatabasePath.isEmpty()) {
        const QFileInfo info(legacyDatabasePath);
        QDir().mkpath(info.absolutePath());
        return info.absolutePath();
    }
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    if (dir.isEmpty()) {
        dir = QDir::homePath() + QStringLiteral("/.local/share/MemGraph");
    }
    QDir().mkpath(dir);
    return dir;
}

void AppSettings::setDataDirectory(const QString &value)
{
    const QString trimmed = value.trimmed();
    if (trimmed.isEmpty()) {
        return;
    }
    QDir().mkpath(trimmed);
    settings_.setValue(QStringLiteral("database/directory"), trimmed);
}

QString AppSettings::baseUrl() const
{
    return settings_.value(QStringLiteral("api/base_url"), QString::fromLatin1(kDefaultBaseUrl)).toString();
}

void AppSettings::setBaseUrl(const QString &value)
{
    settings_.setValue(QStringLiteral("api/base_url"), value.trimmed());
}

QString AppSettings::model() const
{
    return settings_.value(QStringLiteral("api/model"), QString::fromLatin1(kDefaultModel)).toString();
}

void AppSettings::setModel(const QString &value)
{
    settings_.setValue(QStringLiteral("api/model"), value.trimmed());
}

AuthMode AppSettings::authMode() const
{
    return authModeFromString(settings_.value(QStringLiteral("api/auth_mode"), QStringLiteral("api_key")).toString());
}

void AppSettings::setAuthMode(AuthMode mode)
{
    settings_.setValue(QStringLiteral("api/auth_mode"), authModeToString(mode));
}

ApiMode AppSettings::apiMode() const
{
    return apiModeFromString(settings_.value(QStringLiteral("api/mode"), QStringLiteral("responses")).toString());
}

void AppSettings::setApiMode(ApiMode mode)
{
    settings_.setValue(QStringLiteral("api/mode"), apiModeToString(mode));
}

QString AppSettings::uiLanguage() const
{
    return settings_.value(QStringLiteral("ui/language"), QStringLiteral("system")).toString();
}

void AppSettings::setUiLanguage(const QString &value)
{
    settings_.setValue(QStringLiteral("ui/language"), value);
}

bool AppSettings::autoGenerateLinkedNodes() const
{
    return settings_.value(QStringLiteral("generation/auto_generate_linked_nodes"), false).toBool();
}

void AppSettings::setAutoGenerateLinkedNodes(bool value)
{
    settings_.setValue(QStringLiteral("generation/auto_generate_linked_nodes"), value);
}
