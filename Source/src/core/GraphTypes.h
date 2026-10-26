#pragma once

#include <QDateTime>
#include <QString>

enum class ApiMode {
    Responses,
    ChatCompletionsCompatible
};

enum class AuthMode {
    ApiKey,
    ChatGptLogin
};

inline QString authModeToString(AuthMode mode)
{
    switch (mode) {
    case AuthMode::ApiKey:
        return QStringLiteral("api_key");
    case AuthMode::ChatGptLogin:
        return QStringLiteral("chatgpt_login");
    }
    return QStringLiteral("api_key");
}

inline AuthMode authModeFromString(const QString &value)
{
    if (value == QStringLiteral("chatgpt_login")) {
        return AuthMode::ChatGptLogin;
    }
    return AuthMode::ApiKey;
}

inline QString apiModeToString(ApiMode mode)
{
    switch (mode) {
    case ApiMode::Responses:
        return QStringLiteral("responses");
    case ApiMode::ChatCompletionsCompatible:
        return QStringLiteral("chat_completions");
    }
    return QStringLiteral("responses");
}

inline ApiMode apiModeFromString(const QString &value)
{
    if (value == QStringLiteral("chat_completions")) {
        return ApiMode::ChatCompletionsCompatible;
    }
    return ApiMode::Responses;
}

struct MapRecord {
    qint64 id = 0;
    QString title;
    QString description;
    QDateTime deletedAt;
    QDateTime createdAt;
    QDateTime updatedAt;
};

struct NodeRecord {
    qint64 id = 0;
    qint64 mapId = 0;
    qint64 templateId = 0;
    QString title;
    QString markdown;
    double x = 0.0;
    double y = 0.0;
    QString status;
    QDateTime deletedAt;
    QDateTime createdAt;
    QDateTime updatedAt;
};

struct EdgeRecord {
    qint64 id = 0;
    qint64 mapId = 0;
    qint64 sourceNodeId = 0;
    qint64 targetNodeId = 0;
    QString type;
    QString label;
    QDateTime createdAt;
};

struct PromptTemplate {
    qint64 id = 0;
    QString name;
    QString systemPrompt;
    QString userPrompt;
    bool isDefault = false;
    QDateTime deletedAt;
    QDateTime createdAt;
    QDateTime updatedAt;
};
