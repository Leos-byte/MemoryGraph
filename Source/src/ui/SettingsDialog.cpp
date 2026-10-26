#include "ui/SettingsDialog.h"
#include "api/AiClient.h"
#include "core/TextSanitizer.h"
#include "ui/UiTheme.h"

#include <QDialogButtonBox>
#include <QFileDialog>
#include <QFormLayout>
#include <QFrame>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QMessageBox>
#include <QProcess>
#include <QProcessEnvironment>
#include <QPushButton>
#include <QScrollArea>
#include <QStandardPaths>
#include <QTextCursor>
#include <QTextEdit>
#include <QVBoxLayout>

namespace {
constexpr auto kOpenAiBaseUrl = "https://api.openai.com";
constexpr auto kDeepSeekBaseUrl = "https://api.deepseek.com";

struct ModelPreset {
    const char *id;
    const char *baseUrl;
    const char *model;
    ApiMode apiMode;
    bool supportsChatGptLogin;
};

constexpr ModelPreset kModelPresets[] = {
    {"openai:gpt-5.6-sol", kOpenAiBaseUrl, "gpt-5.6-sol", ApiMode::Responses, true},
    {"openai:gpt-5.6-terra", kOpenAiBaseUrl, "gpt-5.6-terra", ApiMode::Responses, true},
    {"openai:gpt-5.6-luna", kOpenAiBaseUrl, "gpt-5.6-luna", ApiMode::Responses, true},
    {"openai:gpt-5.5", kOpenAiBaseUrl, "gpt-5.5", ApiMode::Responses, true},
    {"openai:gpt-5.4", kOpenAiBaseUrl, "gpt-5.4", ApiMode::Responses, true},
    {"openai:gpt-5.4-mini", kOpenAiBaseUrl, "gpt-5.4-mini", ApiMode::Responses, true},
    {"deepseek:deepseek-v4-flash", kDeepSeekBaseUrl, "deepseek-v4-flash", ApiMode::ChatCompletionsCompatible, false},
    {"deepseek:deepseek-v4-pro", kDeepSeekBaseUrl, "deepseek-v4-pro", ApiMode::ChatCompletionsCompatible, false}
};

const ModelPreset *modelPreset(const QString &id)
{
    for (const ModelPreset &preset : kModelPresets) {
        if (id == QString::fromLatin1(preset.id)) {
            return &preset;
        }
    }
    return nullptr;
}

const ModelPreset *modelPresetForConfiguration(const QString &baseUrl, const QString &model, ApiMode apiMode)
{
    for (const ModelPreset &preset : kModelPresets) {
        if (baseUrl == QString::fromLatin1(preset.baseUrl)
            && model == QString::fromLatin1(preset.model)
            && apiMode == preset.apiMode) {
            return &preset;
        }
    }
    return nullptr;
}
}

SettingsDialog::SettingsDialog(AppSettings *settings, SecretStore *secretStore, QWidget *parent)
    : QDialog(parent)
    , settings_(settings)
    , secretStore_(secretStore)
    , initialDataDirectory_(settings->dataDirectory())
{
    setWindowTitle(tr("Settings"));
    resize(760, 640);
    setMinimumSize(680, 520);

    apiKeyEdit_ = new QLineEdit(this);
    apiKeyEdit_->setEchoMode(QLineEdit::Password);
    apiKeyEdit_->setText(secretStore_->apiKey());
    apiKeyEdit_->setPlaceholderText(tr("sk-..."));

    authModeCombo_ = new QComboBox(this);
    authModeCombo_->addItem(tr("API Key"), authModeToString(AuthMode::ApiKey));
    authModeCombo_->addItem(tr("ChatGPT Login (Codex CLI)"), authModeToString(AuthMode::ChatGptLogin));
    authModeCombo_->setCurrentIndex(settings_->authMode() == AuthMode::ChatGptLogin ? 1 : 0);

    baseUrlEdit_ = new QLineEdit(settings_->baseUrl(), this);
    connect(baseUrlEdit_, &QLineEdit::textChanged, this, [this, previous = QUrl(settings_->baseUrl())](const QString &text) mutable {
        const QUrl next(text);
        if (previous.host() != next.host() || previous.scheme() != next.scheme() || previous.port() != next.port()) {
            apiKeyEdit_->clear();
        }
        previous = next;
    });
    modelEdit_ = new QLineEdit(settings_->model(), this);

    apiModeCombo_ = new QComboBox(this);
    apiModeCombo_->addItem(tr("Responses"), apiModeToString(ApiMode::Responses));
    apiModeCombo_->addItem(tr("Chat Completions Compatible"), apiModeToString(ApiMode::ChatCompletionsCompatible));
    apiModeCombo_->setCurrentIndex(settings_->apiMode() == ApiMode::Responses ? 0 : 1);

    presetCombo_ = new QComboBox(this);
    presetCombo_->addItem(tr("Custom"), QStringLiteral("custom"));
    presetCombo_->addItem(tr("OpenAI GPT-5.6 Sol (Frontier)"), QStringLiteral("openai:gpt-5.6-sol"));
    presetCombo_->addItem(tr("OpenAI GPT-5.6 Terra (Balanced)"), QStringLiteral("openai:gpt-5.6-terra"));
    presetCombo_->addItem(tr("OpenAI GPT-5.6 Luna (Fast)"), QStringLiteral("openai:gpt-5.6-luna"));
    presetCombo_->addItem(tr("OpenAI GPT-5.5"), QStringLiteral("openai:gpt-5.5"));
    presetCombo_->addItem(tr("OpenAI GPT-5.4"), QStringLiteral("openai:gpt-5.4"));
    presetCombo_->addItem(tr("OpenAI GPT-5.4 Mini"), QStringLiteral("openai:gpt-5.4-mini"));
    presetCombo_->addItem(tr("DeepSeek V4 Flash (Latest)"), QStringLiteral("deepseek:deepseek-v4-flash"));
    presetCombo_->addItem(tr("DeepSeek V4 Pro"), QStringLiteral("deepseek:deepseek-v4-pro"));

    const QString normalizedBaseUrl = settings_->baseUrl().trimmed();
    const QString normalizedModel = settings_->model().trimmed();
    const ApiMode configuredApiMode = settings_->apiMode();
    if (normalizedBaseUrl == QString::fromLatin1(kOpenAiBaseUrl)
        && normalizedModel == QStringLiteral("gpt-5.6")
        && configuredApiMode == ApiMode::Responses) {
        presetCombo_->setCurrentIndex(presetCombo_->findData(QStringLiteral("openai:gpt-5.6-sol")));
        modelEdit_->setText(QStringLiteral("gpt-5.6-sol"));
    } else if (const ModelPreset *preset = modelPresetForConfiguration(normalizedBaseUrl, normalizedModel, configuredApiMode)) {
        presetCombo_->setCurrentIndex(presetCombo_->findData(QString::fromLatin1(preset->id)));
    }

    connect(presetCombo_, &QComboBox::currentIndexChanged, this, [this]() {
        if (const ModelPreset *preset = modelPreset(presetCombo_->currentData().toString())) {
            baseUrlEdit_->setText(QString::fromLatin1(preset->baseUrl));
            modelEdit_->setText(QString::fromLatin1(preset->model));
            apiModeCombo_->setCurrentIndex(apiModeCombo_->findData(apiModeToString(preset->apiMode)));
            if (!preset->supportsChatGptLogin) {
                authModeCombo_->setCurrentIndex(authModeCombo_->findData(authModeToString(AuthMode::ApiKey)));
            }
            updateAuthenticationUi();
        }
    });

    auto markCustom = [this]() {
        const ApiMode currentApiMode = apiModeFromString(apiModeCombo_->currentData().toString());
        if (!modelPresetForConfiguration(baseUrlEdit_->text().trimmed(), modelEdit_->text().trimmed(), currentApiMode)) {
            presetCombo_->setCurrentIndex(presetCombo_->findData(QStringLiteral("custom")));
        }
    };
    connect(baseUrlEdit_, &QLineEdit::textEdited, this, markCustom);
    connect(modelEdit_, &QLineEdit::textEdited, this, markCustom);
    connect(apiModeCombo_, &QComboBox::currentIndexChanged, this, markCustom);

    chatGptStatusLabel_ = new QLabel(this);
    chatGptStatusLabel_->setWordWrap(true);
    chatGptLoginButton_ = new QPushButton(
        UiTheme::icon(QStringLiteral("system-log-in"), QStyle::SP_DialogApplyButton), tr("Sign in with ChatGPT"), this);
    chatGptLoginButton_->setProperty("variant", QStringLiteral("primary"));
    chatGptRefreshButton_ = new QPushButton(
        UiTheme::icon(QStringLiteral("view-refresh"), QStyle::SP_BrowserReload), tr("Refresh Login Status"), this);
    connect(chatGptLoginButton_, &QPushButton::clicked, this, &SettingsDialog::startChatGptLogin);
    connect(chatGptRefreshButton_, &QPushButton::clicked, this, &SettingsDialog::refreshChatGptLoginStatus);

    auto *chatGptStatusLayout = new QHBoxLayout;
    chatGptStatusLayout->addWidget(chatGptStatusLabel_, 1);
    chatGptStatusLayout->addWidget(chatGptLoginButton_);
    chatGptStatusLayout->addWidget(chatGptRefreshButton_);

    connect(authModeCombo_, &QComboBox::currentIndexChanged, this, [this]() {
        const AuthMode mode = authModeFromString(authModeCombo_->currentData().toString());
        if (mode == AuthMode::ChatGptLogin && baseUrlEdit_->text().trimmed() != QString::fromLatin1(kOpenAiBaseUrl)) {
            presetCombo_->setCurrentIndex(presetCombo_->findData(QStringLiteral("openai:gpt-5.6-terra")));
        }
        updateAuthenticationUi();
        if (mode == AuthMode::ChatGptLogin) {
            refreshChatGptLoginStatus();
        }
    });

    languageCombo_ = new QComboBox(this);
    languageCombo_->addItem(tr("Follow system"), QStringLiteral("system"));
    languageCombo_->addItem(tr("Chinese"), QStringLiteral("zh_CN"));
    languageCombo_->addItem(tr("English"), QStringLiteral("en_US"));
    const int languageIndex = languageCombo_->findData(settings_->uiLanguage());
    if (languageIndex >= 0) {
        languageCombo_->setCurrentIndex(languageIndex);
    }

    autoGenerateLinkedNodesCheck_ = new QCheckBox(tr("Automatically generate explanation when creating linked nodes"), this);
    autoGenerateLinkedNodesCheck_->setChecked(settings_->autoGenerateLinkedNodes());

    dataDirectoryEdit_ = new QLineEdit(initialDataDirectory_, this);
    auto *browseDataDirectoryButton = new QPushButton(
        UiTheme::icon(QStringLiteral("document-open-folder"), QStyle::SP_DirOpenIcon), tr("Browse"), this);
    connect(browseDataDirectoryButton, &QPushButton::clicked, this, [this]() {
        const QString directory = QFileDialog::getExistingDirectory(this, tr("Select Database Directory"), dataDirectoryEdit_->text());
        if (!directory.isEmpty()) {
            dataDirectoryEdit_->setText(directory);
        }
    });

    auto *dataDirectoryLayout = new QHBoxLayout;
    dataDirectoryLayout->addWidget(dataDirectoryEdit_, 1);
    dataDirectoryLayout->addWidget(browseDataDirectoryButton);

    auto configureForm = [](QFormLayout *form) {
        form->setFieldGrowthPolicy(QFormLayout::AllNonFixedFieldsGrow);
        form->setRowWrapPolicy(QFormLayout::WrapLongRows);
        form->setLabelAlignment(Qt::AlignLeft | Qt::AlignTop);
        form->setHorizontalSpacing(18);
        form->setVerticalSpacing(10);
    };

    auto *modelGroup = new QGroupBox(tr("Model & Authentication"), this);
    auto *modelLayout = new QVBoxLayout(modelGroup);
    auto *modelForm = new QFormLayout;
    configureForm(modelForm);
    modelForm->addRow(tr("Authentication"), authModeCombo_);
    apiKeyRowLabel_ = new QLabel(tr("API Key"), this);
    modelForm->addRow(apiKeyRowLabel_, apiKeyEdit_);
    chatGptRowLabel_ = new QLabel(tr("ChatGPT Login"), this);
    modelForm->addRow(chatGptRowLabel_, chatGptStatusLayout);
    modelForm->addRow(tr("Model Preset"), presetCombo_);
    modelForm->addRow(tr("Base URL"), baseUrlEdit_);
    modelForm->addRow(tr("Model"), modelEdit_);
    modelForm->addRow(tr("API Mode"), apiModeCombo_);
    modelLayout->addLayout(modelForm);

    auto *modelPresetHintLabel = new QLabel(
        tr("OpenAI presets match the models currently shown by Codex. Availability depends on your OpenAI account; use Custom for another supported model ID."),
        this);
    modelPresetHintLabel->setWordWrap(true);
    modelPresetHintLabel->setProperty("role", QStringLiteral("muted"));
    modelLayout->addWidget(modelPresetHintLabel);

    const QString secretHint = secretStore_->hasPersistentBackend()
        ? tr("The API key is stored with the system secret service and is never written to the project database.")
        : tr("No system secret service was found. The API key is kept in memory for this app session only.");
    apiKeyHintLabel_ = new QLabel(secretHint, this);
    apiKeyHintLabel_->setWordWrap(true);
    apiKeyHintLabel_->setProperty("role", QStringLiteral("muted"));
    modelLayout->addWidget(apiKeyHintLabel_);

    chatGptHintLabel_ = new QLabel(
        tr("ChatGPT login uses the official Codex CLI. MemGraph never reads or stores your ChatGPT credentials. This option is available for OpenAI models only."),
        this);
    chatGptHintLabel_->setWordWrap(true);
    chatGptHintLabel_->setProperty("role", QStringLiteral("muted"));
    modelLayout->addWidget(chatGptHintLabel_);

    auto *learningGroup = new QGroupBox(tr("Learning Preferences"), this);
    auto *learningForm = new QFormLayout(learningGroup);
    configureForm(learningForm);
    learningForm->addRow(tr("Language"), languageCombo_);
    learningForm->addRow(tr("Linked Node Generation"), autoGenerateLinkedNodesCheck_);

    auto *dataGroup = new QGroupBox(tr("Data Storage"), this);
    auto *dataForm = new QFormLayout(dataGroup);
    configureForm(dataForm);
    dataForm->addRow(tr("Database Directory"), dataDirectoryLayout);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    QPushButton *saveSettingsButton = buttons->button(QDialogButtonBox::Ok);
    saveSettingsButton->setProperty("variant", QStringLiteral("primary"));
    saveSettingsButton->setText(tr("Save Settings"));
    saveSettingsButton->style()->unpolish(saveSettingsButton);
    saveSettingsButton->style()->polish(saveSettingsButton);
    buttons->button(QDialogButtonBox::Cancel)->setText(tr("Cancel"));
    connect(buttons, &QDialogButtonBox::accepted, this, &SettingsDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &SettingsDialog::reject);

    auto *content = new QWidget(this);
    auto *contentLayout = new QVBoxLayout(content);
    contentLayout->setContentsMargins(8, 4, 8, 12);
    contentLayout->setSpacing(12);
    contentLayout->addWidget(modelGroup);
    contentLayout->addWidget(learningGroup);
    contentLayout->addWidget(dataGroup);
    contentLayout->addStretch();

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setWidget(content);

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->addWidget(scrollArea, 1);
    layout->addWidget(buttons);

    updateAuthenticationUi();
    if (settings_->authMode() == AuthMode::ChatGptLogin) {
        refreshChatGptLoginStatus();
    }
}

void SettingsDialog::updateAuthenticationUi()
{
    const bool chatGptLogin = authModeFromString(authModeCombo_->currentData().toString()) == AuthMode::ChatGptLogin;
    apiKeyEdit_->setEnabled(!chatGptLogin);
    apiKeyEdit_->setVisible(!chatGptLogin);
    apiKeyRowLabel_->setVisible(!chatGptLogin);
    baseUrlEdit_->setEnabled(!chatGptLogin);
    apiModeCombo_->setEnabled(!chatGptLogin);
    chatGptRowLabel_->setVisible(chatGptLogin);
    chatGptStatusLabel_->setVisible(chatGptLogin);
    chatGptLoginButton_->setVisible(chatGptLogin);
    chatGptRefreshButton_->setVisible(chatGptLogin);
    apiKeyHintLabel_->setVisible(!chatGptLogin);
    chatGptHintLabel_->setVisible(chatGptLogin);
}

void SettingsDialog::refreshChatGptLoginStatus()
{
    const QString codex = QStandardPaths::findExecutable(QStringLiteral("codex"));
    if (codex.isEmpty()) {
        chatGptStatusLabel_->setText(tr("Codex CLI was not found. Install it with: npm install -g @openai/codex"));
        chatGptRefreshButton_->setEnabled(true);
        return;
    }

    chatGptStatusLabel_->setText(tr("Checking ChatGPT login..."));
    chatGptRefreshButton_->setEnabled(false);
    auto *process = new QProcess(this);
    process->setProcessChannelMode(QProcess::MergedChannels);
    connect(process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), this,
            [this, process](int exitCode, QProcess::ExitStatus exitStatus) {
                const QString output = QString::fromUtf8(process->readAll()).trimmed();
                if (exitStatus == QProcess::NormalExit && exitCode == 0
                    && output.contains(QStringLiteral("Logged in using ChatGPT"), Qt::CaseInsensitive)) {
                    chatGptStatusLabel_->setText(tr("Logged in with ChatGPT."));
                } else {
                    chatGptStatusLabel_->setText(tr("Not logged in with ChatGPT."));
                }
                chatGptRefreshButton_->setEnabled(true);
                process->deleteLater();
            });
    connect(process, &QProcess::errorOccurred, this, [this, process](QProcess::ProcessError error) {
        if (error == QProcess::FailedToStart) {
            chatGptStatusLabel_->setText(tr("Unable to check ChatGPT login: %1").arg(process->errorString()));
            chatGptRefreshButton_->setEnabled(true);
            process->deleteLater();
        }
    });
    process->start(codex, {QStringLiteral("login"), QStringLiteral("status")});
}

void SettingsDialog::startChatGptLogin()
{
    const QString codex = QStandardPaths::findExecutable(QStringLiteral("codex"));
    if (codex.isEmpty()) {
        QMessageBox::information(this, tr("ChatGPT Login"),
                                 tr("Codex CLI was not found. Install it with: npm install -g @openai/codex"));
        return;
    }

    QDialog loginDialog(this);
    loginDialog.setWindowTitle(tr("Sign in with ChatGPT"));
    loginDialog.resize(680, 420);

    auto *instructions = new QLabel(
        tr("Complete the device login in your browser using the URL and code shown below."), &loginDialog);
    instructions->setWordWrap(true);
    auto *output = new QTextEdit(&loginDialog);
    output->setReadOnly(true);
    auto *closeButton = new QPushButton(tr("Cancel"), &loginDialog);

    auto *layout = new QVBoxLayout(&loginDialog);
    layout->addWidget(instructions);
    layout->addWidget(output, 1);
    layout->addWidget(closeButton, 0, Qt::AlignRight);

    QProcess process(&loginDialog);
    process.setProcessChannelMode(QProcess::MergedChannels);
    QProcessEnvironment environment = QProcessEnvironment::systemEnvironment();
    environment.insert(QStringLiteral("NO_COLOR"), QStringLiteral("1"));
    environment.insert(QStringLiteral("CLICOLOR"), QStringLiteral("0"));
    environment.insert(QStringLiteral("TERM"), QStringLiteral("dumb"));
    process.setProcessEnvironment(environment);

    QString rawOutput;
    auto refreshOutput = [&process, output, &rawOutput]() {
        rawOutput.append(QString::fromUtf8(process.readAll()));
        output->setPlainText(TextSanitizer::stripTerminalSequences(rawOutput));
        output->moveCursor(QTextCursor::End);
    };
    connect(&process, &QProcess::readyRead, &loginDialog, refreshOutput);
    connect(&process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), &loginDialog,
            [this, &process, output, closeButton, &rawOutput](int exitCode, QProcess::ExitStatus exitStatus) {
                rawOutput.append(QString::fromUtf8(process.readAll()));
                QString displayed = TextSanitizer::stripTerminalSequences(rawOutput).trimmed();
                if (!displayed.isEmpty()) {
                    displayed.append(QStringLiteral("\n\n"));
                }
                displayed.append(exitStatus == QProcess::NormalExit && exitCode == 0
                                     ? tr("ChatGPT login completed.")
                                     : tr("ChatGPT login did not complete."));
                output->setPlainText(displayed);
                output->moveCursor(QTextCursor::End);
                closeButton->setText(tr("Close"));
            });
    connect(closeButton, &QPushButton::clicked, &loginDialog, [&loginDialog, &process]() {
        if (process.state() != QProcess::NotRunning) {
            process.kill();
            process.waitForFinished(2000);
        }
        loginDialog.accept();
    });

    process.start(codex, {QStringLiteral("login"), QStringLiteral("--device-auth")});
    if (!process.waitForStarted(3000)) {
        output->setPlainText(tr("Unable to start Codex CLI: %1").arg(process.errorString()));
        closeButton->setText(tr("Close"));
    }
    loginDialog.exec();
    if (process.state() != QProcess::NotRunning) {
        process.kill();
        process.waitForFinished(2000);
    }
    refreshChatGptLoginStatus();
}

QString SettingsDialog::selectedDataDirectory() const
{
    return dataDirectoryEdit_->text().trimmed();
}

bool SettingsDialog::dataDirectoryChanged() const
{
    return selectedDataDirectory() != initialDataDirectory_;
}

void SettingsDialog::accept()
{
    if (authModeFromString(authModeCombo_->currentData().toString()) == AuthMode::ApiKey
        && !AiClient::isSecureBaseUrl(baseUrlEdit_->text())) {
        QMessageBox::warning(this, tr("Settings"),
                             tr("API Base URL must use HTTPS without credentials, query, or fragment."));
        return;
    }
    secretStore_->setApiKey(apiKeyEdit_->text());
    settings_->setAuthMode(authModeFromString(authModeCombo_->currentData().toString()));
    settings_->setBaseUrl(baseUrlEdit_->text());
    settings_->setModel(modelEdit_->text());
    settings_->setApiMode(apiModeFromString(apiModeCombo_->currentData().toString()));
    settings_->setUiLanguage(languageCombo_->currentData().toString());
    settings_->setAutoGenerateLinkedNodes(autoGenerateLinkedNodesCheck_->isChecked());
    settings_->setDataDirectory(dataDirectoryEdit_->text());
    QDialog::accept();
}
