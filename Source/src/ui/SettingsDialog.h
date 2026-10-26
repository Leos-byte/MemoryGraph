#pragma once

#include "core/AppSettings.h"
#include "core/SecretStore.h"

#include <QComboBox>
#include <QCheckBox>
#include <QDialog>
#include <QLineEdit>

class QLabel;
class QPushButton;

class SettingsDialog : public QDialog {
    Q_OBJECT

public:
    SettingsDialog(AppSettings *settings, SecretStore *secretStore, QWidget *parent = nullptr);
    QString selectedDataDirectory() const;
    bool dataDirectoryChanged() const;

protected:
    void accept() override;

private:
    void updateAuthenticationUi();
    void refreshChatGptLoginStatus();
    void startChatGptLogin();

    AppSettings *settings_ = nullptr;
    SecretStore *secretStore_ = nullptr;
    QComboBox *presetCombo_ = nullptr;
    QComboBox *authModeCombo_ = nullptr;
    QLineEdit *apiKeyEdit_ = nullptr;
    QLabel *apiKeyRowLabel_ = nullptr;
    QLabel *chatGptRowLabel_ = nullptr;
    QLabel *chatGptStatusLabel_ = nullptr;
    QLabel *apiKeyHintLabel_ = nullptr;
    QLabel *chatGptHintLabel_ = nullptr;
    QPushButton *chatGptLoginButton_ = nullptr;
    QPushButton *chatGptRefreshButton_ = nullptr;
    QLineEdit *baseUrlEdit_ = nullptr;
    QLineEdit *modelEdit_ = nullptr;
    QComboBox *apiModeCombo_ = nullptr;
    QComboBox *languageCombo_ = nullptr;
    QCheckBox *autoGenerateLinkedNodesCheck_ = nullptr;
    QLineEdit *dataDirectoryEdit_ = nullptr;
    QString initialDataDirectory_;
};
