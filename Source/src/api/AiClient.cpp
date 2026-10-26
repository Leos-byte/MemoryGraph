#include "api/AiClient.h"
#include "core/TextSanitizer.h"

#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QProcess>
#include <QStandardPaths>
#include <QStringList>
#include <QTemporaryDir>
#include <QTimer>
#include <memory>

namespace {
constexpr qint64 kMaxResponseBytes = 4 * 1024 * 1024;
}

AiClient::AiClient(QObject *parent)
    : QObject(parent)
{
}

AiClient::~AiClient()
{
    cancelAll();
}

void AiClient::cancelAll()
{
    for (auto *reply : network_.findChildren<QNetworkReply *>()) {
        disconnect(reply, nullptr, this, nullptr);
        reply->abort();
        reply->deleteLater();
    }
    for (auto *process : findChildren<QProcess *>()) {
        disconnect(process, nullptr, this, nullptr);
        process->kill();
        process->waitForFinished(2000);
        process->deleteLater();
    }
}

bool AiClient::isSecureBaseUrl(const QString &baseUrl)
{
    if (baseUrl.trimmed().isEmpty()) {
        return true;
    }
    const QUrl url(baseUrl.trimmed(), QUrl::StrictMode);
    return url.isValid() && url.scheme() == QStringLiteral("https")
        && !url.host().isEmpty() && url.userInfo().isEmpty()
        && !url.hasQuery() && !url.hasFragment();
}

void AiClient::generateExplanation(const AiRequest &request)
{
    if (request.authMode == AuthMode::ChatGptLogin) {
        generateWithChatGptLogin(request);
        return;
    }

    generateWithApiKey(request);
}

void AiClient::generateWithApiKey(const AiRequest &request)
{
    if (!isSecureBaseUrl(request.baseUrl)) {
        emit generationFailed(request.nodeId, tr("API Base URL must use HTTPS without credentials, query, or fragment."));
        return;
    }
    if (request.apiKey.trimmed().isEmpty()) {
        emit generationFailed(request.nodeId, tr("API key is empty. Open Settings and enter a key first."));
        return;
    }

    QNetworkRequest netRequest(endpointUrl(request.baseUrl, request.apiMode));
    netRequest.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::ManualRedirectPolicy);
    netRequest.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    netRequest.setRawHeader("Authorization", "Bearer " + request.apiKey.toUtf8());

    QNetworkReply *reply = network_.post(netRequest, buildRequestBody(request));
    reply->setReadBufferSize(64 * 1024);
    auto body = std::make_shared<QByteArray>();
    auto drain = [reply, body]() {
        body->append(reply->read(kMaxResponseBytes + 1 - body->size()));
        if (body->size() > kMaxResponseBytes) {
            reply->setProperty("sizeLimitExceeded", true);
            reply->abort();
        }
    };
    connect(reply, &QIODevice::readyRead, this, drain);
    auto *timeout = new QTimer(reply);
    timeout->setSingleShot(true);
    connect(timeout, &QTimer::timeout, reply, [reply]() { reply->abort(); });
    timeout->start(120000);
    connect(reply, &QNetworkReply::finished, this, [this, reply, request, body, timeout]() {
        timeout->stop();
        body->append(reply->read(kMaxResponseBytes + 1 - body->size()));
        if (body->size() > kMaxResponseBytes || reply->property("sizeLimitExceeded").toBool()) {
            emit generationFailed(request.nodeId, tr("API response exceeded the size limit."));
            reply->deleteLater();
            return;
        }
        const int httpStatus = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        if (httpStatus >= 300 && httpStatus < 400) {
            emit generationFailed(request.nodeId, tr("API redirects are blocked. Configure the final HTTPS endpoint in Settings."));
            reply->deleteLater();
            return;
        }

        QString parseError;
        QString markdown = parseResponse(request.apiMode, *body, &parseError);
        if (reply->error() != QNetworkReply::NoError || httpStatus >= 400 || markdown.trimmed().isEmpty()) {
            QString error = parseError;
            if (error.isEmpty()) {
                error = reply->errorString();
            }
            if (httpStatus > 0) {
                error = tr("HTTP %1: %2").arg(httpStatus).arg(error);
            }
            error.replace(request.apiKey, QStringLiteral("[redacted]"));
            emit generationFailed(request.nodeId, error);
        } else {
            emit generationFinished(request.nodeId, markdown.trimmed());
        }
        reply->deleteLater();
    });
}

void AiClient::generateWithChatGptLogin(const AiRequest &request)
{
    const QString codex = QStandardPaths::findExecutable(QStringLiteral("codex"));
    if (codex.isEmpty()) {
        emit generationFailed(request.nodeId,
                              tr("Codex CLI was not found. Install it with: npm install -g @openai/codex"));
        return;
    }

    auto temporaryDirectory = std::make_shared<QTemporaryDir>(QDir::tempPath() + QStringLiteral("/memgraph-codex-XXXXXX"));
    if (!temporaryDirectory->isValid()) {
        emit generationFailed(request.nodeId, tr("Unable to create a temporary directory for ChatGPT generation."));
        return;
    }

    const QString outputPath = temporaryDirectory->filePath(QStringLiteral("answer.md"));
    const QString model = request.model.trimmed().isEmpty() ? QStringLiteral("gpt-5.6-terra") : request.model.trimmed();
    QStringList arguments{
        QStringLiteral("exec"),
        QStringLiteral("--ephemeral"),
        QStringLiteral("--ignore-user-config"),
        QStringLiteral("--ignore-rules"),
        QStringLiteral("-c"), QStringLiteral("approval_policy=\"never\""),
        QStringLiteral("-c"), QStringLiteral("web_search=\"disabled\""),
        QStringLiteral("-c"), QStringLiteral("tools.view_image=false"),
        QStringLiteral("-c"), QStringLiteral("shell_environment_policy.inherit=\"none\""),
        QStringLiteral("--sandbox"),
        QStringLiteral("read-only"),
        QStringLiteral("--skip-git-repo-check"),
        QStringLiteral("--color"),
        QStringLiteral("never"),
        QStringLiteral("--model"),
        model,
        QStringLiteral("--output-last-message"),
        outputPath,
        QStringLiteral("-")
    };
    const QStringList disabledFeatures{
        QStringLiteral("shell_tool"), QStringLiteral("shell_snapshot"),
        QStringLiteral("apps"), QStringLiteral("plugins"), QStringLiteral("remote_plugin"),
        QStringLiteral("hooks"), QStringLiteral("multi_agent"), QStringLiteral("multi_agent_v2"),
        QStringLiteral("browser_use"), QStringLiteral("computer_use"),
        QStringLiteral("code_mode"), QStringLiteral("code_mode_host"),
        QStringLiteral("view_image"), QStringLiteral("image_generation")
    };
    for (const QString &feature : disabledFeatures) {
        arguments.insert(arguments.size() - 1, QStringLiteral("-c"));
        arguments.insert(arguments.size() - 1, QStringLiteral("features.%1=false").arg(feature));
    }

    const QString prompt = QStringLiteral(
        "You are the text-generation backend for MemGraph. Do not inspect files, run commands, "
        "call tools, or modify anything. Follow the instructions below and return only the final "
        "Markdown answer. Do not use emoji, pictographs, decorative Unicode symbols, or Unicode "
        "arrows. Use plain ASCII arrows such as -> in diagrams.\n\nSYSTEM INSTRUCTIONS:\n%1\n\nUSER REQUEST:\n%2\n")
                               .arg(request.systemPrompt, request.userPrompt);

    auto *process = new QProcess(this);
    process->setWorkingDirectory(temporaryDirectory->path());
    process->setProcessChannelMode(QProcess::SeparateChannels);
    auto *timeout = new QTimer(process);
    timeout->setSingleShot(true);
    connect(timeout, &QTimer::timeout, process, &QProcess::kill);
    timeout->start(600000);
    auto diagnostic = std::make_shared<QByteArray>();
    connect(process, &QProcess::readyReadStandardOutput, process, [process]() {
        process->readAllStandardOutput();
    });
    connect(process, &QProcess::readyReadStandardError, process, [process, diagnostic]() {
        diagnostic->append(process->readAllStandardError());
        *diagnostic = diagnostic->right(16384);
    });

    connect(process, &QProcess::started, process, [process, prompt]() {
        process->write(prompt.toUtf8());
        process->closeWriteChannel();
    });
    connect(process, &QProcess::errorOccurred, this,
            [this, process, temporaryDirectory, request](QProcess::ProcessError error) {
                if (error != QProcess::FailedToStart || process->property("memgraphHandled").toBool()) {
                    return;
                }
                process->setProperty("memgraphHandled", true);
                emit generationFailed(request.nodeId, tr("Unable to start Codex CLI: %1").arg(process->errorString()));
                process->deleteLater();
            });
    connect(process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this,
            [this, process, temporaryDirectory, outputPath, request, diagnostic, timeout](int exitCode, QProcess::ExitStatus exitStatus) {
                timeout->stop();
                if (process->property("memgraphHandled").toBool()) {
                    return;
                }
                process->setProperty("memgraphHandled", true);

                QFile output(outputPath);
                QString markdown;
                if (output.open(QIODevice::ReadOnly | QIODevice::Text) && output.size() <= kMaxResponseBytes) {
                    markdown = TextSanitizer::normalizeCodexMarkdown(QString::fromUtf8(output.readAll()));
                }

                if (exitStatus == QProcess::NormalExit && exitCode == 0 && !markdown.isEmpty()) {
                    emit generationFinished(request.nodeId, markdown);
                } else {
                    diagnostic->append(process->readAllStandardError());
                    QString error = TextSanitizer::stripTerminalSequences(QString::fromUtf8(diagnostic->right(16384))).trimmed();
                    if (error.isEmpty()) {
                        error = tr("ChatGPT generation failed. Check the Codex CLI login status and selected model.");
                    }
                    emit generationFailed(request.nodeId, error);
                }

                process->deleteLater();
            });

    process->start(codex, arguments);
}

QUrl AiClient::endpointUrl(const QString &baseUrl, ApiMode mode) const
{
    QString base = baseUrl.trimmed();
    if (base.isEmpty()) {
        base = QStringLiteral("https://api.openai.com");
    }
    while (base.endsWith(QLatin1Char('/'))) {
        base.chop(1);
    }

    QString path;
    if (mode == ApiMode::Responses) {
        path = base.endsWith(QStringLiteral("/v1")) ? QStringLiteral("/responses") : QStringLiteral("/v1/responses");
    } else {
        path = base.endsWith(QStringLiteral("/v1")) ? QStringLiteral("/chat/completions") : QStringLiteral("/v1/chat/completions");
    }

    return QUrl(base + path);
}

QByteArray AiClient::buildRequestBody(const AiRequest &request) const
{
    QJsonObject root;
    root.insert(QStringLiteral("model"), request.model.trimmed().isEmpty() ? QStringLiteral("gpt-5.6-terra") : request.model.trimmed());

    if (request.apiMode == ApiMode::Responses) {
        QJsonArray input;
        input.append(QJsonObject{
            {QStringLiteral("role"), QStringLiteral("system")},
            {QStringLiteral("content"), request.systemPrompt}
        });
        input.append(QJsonObject{
            {QStringLiteral("role"), QStringLiteral("user")},
            {QStringLiteral("content"), request.userPrompt}
        });
        root.insert(QStringLiteral("input"), input);
        root.insert(QStringLiteral("store"), false);
    } else {
        QJsonArray messages;
        messages.append(QJsonObject{
            {QStringLiteral("role"), QStringLiteral("system")},
            {QStringLiteral("content"), request.systemPrompt}
        });
        messages.append(QJsonObject{
            {QStringLiteral("role"), QStringLiteral("user")},
            {QStringLiteral("content"), request.userPrompt}
        });
        root.insert(QStringLiteral("messages"), messages);
    }

    return QJsonDocument(root).toJson(QJsonDocument::Compact);
}

QString AiClient::parseResponse(ApiMode mode, const QByteArray &body, QString *errorMessage) const
{
    QJsonParseError parseError;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseError);
    if (parseError.error != QJsonParseError::NoError || !doc.isObject()) {
        if (errorMessage) {
            *errorMessage = parseError.errorString();
        }
        return {};
    }

    const QJsonObject root = doc.object();
    const QJsonObject error = root.value(QStringLiteral("error")).toObject();
    if (!error.isEmpty()) {
        if (errorMessage) {
            *errorMessage = error.value(QStringLiteral("message")).toString(tr("API request failed."));
        }
        return {};
    }

    if (mode == ApiMode::Responses) {
        const QString direct = root.value(QStringLiteral("output_text")).toString();
        if (!direct.trimmed().isEmpty()) {
            return direct;
        }

        QStringList parts;
        const QJsonArray output = root.value(QStringLiteral("output")).toArray();
        for (const QJsonValue &itemValue : output) {
            const QJsonObject item = itemValue.toObject();
            const QJsonArray content = item.value(QStringLiteral("content")).toArray();
            for (const QJsonValue &contentValue : content) {
                const QJsonObject contentItem = contentValue.toObject();
                const QString type = contentItem.value(QStringLiteral("type")).toString();
                if (type == QStringLiteral("output_text") || type == QStringLiteral("text")) {
                    const QString text = contentItem.value(QStringLiteral("text")).toString();
                    if (!text.isEmpty()) {
                        parts.append(text);
                    }
                }
            }
        }
        return parts.join(QStringLiteral("\n\n"));
    }

    const QJsonArray choices = root.value(QStringLiteral("choices")).toArray();
    if (!choices.isEmpty()) {
        return choices.at(0).toObject()
            .value(QStringLiteral("message")).toObject()
            .value(QStringLiteral("content")).toString();
    }

    if (errorMessage) {
        *errorMessage = tr("The API response did not contain generated text.");
    }
    return {};
}
