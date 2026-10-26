#pragma once

#include "core/GraphTypes.h"

#include <QNetworkAccessManager>
#include <QObject>
#include <QString>

struct AiRequest {
    qint64 nodeId = 0;
    QString apiKey;
    QString baseUrl;
    QString model;
    AuthMode authMode = AuthMode::ApiKey;
    ApiMode apiMode = ApiMode::Responses;
    QString systemPrompt;
    QString userPrompt;
};

class AiClient : public QObject {
    Q_OBJECT

public:
    explicit AiClient(QObject *parent = nullptr);
    ~AiClient() override;

    void generateExplanation(const AiRequest &request);
    void cancelAll();
    static bool isSecureBaseUrl(const QString &baseUrl);

signals:
    void generationFinished(qint64 nodeId, const QString &markdown);
    void generationFailed(qint64 nodeId, const QString &errorMessage);

private:
    void generateWithApiKey(const AiRequest &request);
    void generateWithChatGptLogin(const AiRequest &request);
    QUrl endpointUrl(const QString &baseUrl, ApiMode mode) const;
    QByteArray buildRequestBody(const AiRequest &request) const;
    QString parseResponse(ApiMode mode, const QByteArray &body, QString *errorMessage) const;

    QNetworkAccessManager network_;
};
