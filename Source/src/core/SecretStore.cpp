#include "core/SecretStore.h"

#include <QProcess>
#include <QStandardPaths>

namespace {
constexpr auto kApplicationAttribute = "application";
constexpr auto kApplicationValue = "MemGraph";
constexpr auto kAccountAttribute = "account";
constexpr auto kAccountValue = "default";
constexpr int kSecretToolTimeoutMs = 3000;
}

SecretStore::SecretStore()
    : apiKey_(readFromSecretTool())
{
}

QString SecretStore::apiKey() const
{
    return apiKey_;
}

void SecretStore::setApiKey(const QString &key)
{
    apiKey_ = key.trimmed();
    writeToSecretTool(apiKey_);
}

bool SecretStore::hasApiKey() const
{
    return !apiKey_.trimmed().isEmpty();
}

bool SecretStore::hasPersistentBackend() const
{
    return !secretToolPath().isEmpty();
}

QString SecretStore::secretToolPath() const
{
    return QStandardPaths::findExecutable(QStringLiteral("secret-tool"));
}

QString SecretStore::readFromSecretTool() const
{
    const QString tool = secretToolPath();
    if (tool.isEmpty()) {
        return {};
    }

    QProcess process;
    process.start(tool, {
        QStringLiteral("lookup"),
        QString::fromLatin1(kApplicationAttribute),
        QString::fromLatin1(kApplicationValue),
        QString::fromLatin1(kAccountAttribute),
        QString::fromLatin1(kAccountValue)
    });
    if (!process.waitForFinished(kSecretToolTimeoutMs) || process.exitStatus() != QProcess::NormalExit || process.exitCode() != 0) {
        return {};
    }
    return QString::fromUtf8(process.readAllStandardOutput()).trimmed();
}

void SecretStore::writeToSecretTool(const QString &key) const
{
    const QString tool = secretToolPath();
    if (tool.isEmpty()) {
        return;
    }

    QProcess process;
    if (key.trimmed().isEmpty()) {
        process.start(tool, {
            QStringLiteral("clear"),
            QString::fromLatin1(kApplicationAttribute),
            QString::fromLatin1(kApplicationValue),
            QString::fromLatin1(kAccountAttribute),
            QString::fromLatin1(kAccountValue)
        });
        process.waitForFinished(kSecretToolTimeoutMs);
        return;
    }

    process.start(tool, {
        QStringLiteral("store"),
        QStringLiteral("--label=MemGraph API Key"),
        QString::fromLatin1(kApplicationAttribute),
        QString::fromLatin1(kApplicationValue),
        QString::fromLatin1(kAccountAttribute),
        QString::fromLatin1(kAccountValue)
    });
    if (!process.waitForStarted(kSecretToolTimeoutMs)) {
        return;
    }
    process.write(key.toUtf8());
    process.closeWriteChannel();
    process.waitForFinished(kSecretToolTimeoutMs);
}
