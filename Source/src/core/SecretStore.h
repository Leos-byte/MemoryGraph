#pragma once

#include <QString>

class SecretStore {
public:
    SecretStore();

    QString apiKey() const;
    void setApiKey(const QString &key);
    bool hasApiKey() const;
    bool hasPersistentBackend() const;

private:
    QString secretToolPath() const;
    QString readFromSecretTool() const;
    void writeToSecretTool(const QString &key) const;

    QString apiKey_;
};
