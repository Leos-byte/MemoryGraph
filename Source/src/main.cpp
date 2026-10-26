#include "core/AppSettings.h"
#include "core/GraphStore.h"
#include "core/SecretStore.h"
#include "ui/MainWindow.h"
#include "ui/SettingsDialog.h"
#include "ui/TemplateDialog.h"
#include "ui/UiTheme.h"

#include <QApplication>
#include <QDir>
#include <QLocale>
#include <QMessageBox>
#include <QRegularExpression>
#include <QTimer>
#include <QTranslator>
#ifdef Q_OS_UNIX
#include <sys/stat.h>
#endif

namespace {
QString selectedLocale(const AppSettings &settings)
{
    QString locale = settings.uiLanguage();
    if (locale == QStringLiteral("system")) {
        locale = QLocale::system().name();
    }
    if (locale.startsWith(QStringLiteral("zh"))) {
        return QStringLiteral("zh_CN");
    }
    return QStringLiteral("en_US");
}
}

int main(int argc, char *argv[])
{
#ifdef Q_OS_UNIX
    umask(0077);
#endif
    QApplication app(argc, argv);
    QApplication::setOrganizationName(QStringLiteral("MemGraph"));
    QApplication::setApplicationName(QStringLiteral("MemGraph"));
    QApplication::setApplicationVersion(QStringLiteral("0.1.0"));
    UiTheme::apply(app);

    AppSettings settings;

    QTranslator translator;
    const QString locale = selectedLocale(settings);
    const QString translationName = QStringLiteral("memgraph_") + locale;
    const QString installedTranslationDir = QCoreApplication::applicationDirPath() + QStringLiteral("/../i18n");
    const QString buildTranslationDir = QCoreApplication::applicationDirPath() + QStringLiteral("/i18n");
    if (translator.load(translationName, installedTranslationDir) || translator.load(translationName, buildTranslationDir)) {
        app.installTranslator(&translator);
    }

    GraphStore store;
    QString error;
    if (!store.open(settings.databasePath(), &error)) {
        QMessageBox::critical(nullptr, QObject::tr("MemGraph"), QObject::tr("Could not open database:\n%1").arg(error));
        return 1;
    }

    SecretStore secretStore;
    MainWindow window(&store, &settings, &secretStore);
    const QString snapshotSize = qEnvironmentVariable("MEMGRAPH_UI_SNAPSHOT_SIZE");
    const QRegularExpressionMatch sizeMatch = QRegularExpression(QStringLiteral("^(\\d+)x(\\d+)$")).match(snapshotSize);
    if (sizeMatch.hasMatch()) {
        window.resize(sizeMatch.captured(1).toInt(), sizeMatch.captured(2).toInt());
    }
    window.show();

    const QString snapshotPath = qEnvironmentVariable("MEMGRAPH_UI_SNAPSHOT");
    if (!snapshotPath.isEmpty()) {
        QWidget *snapshotTarget = &window;
        const QString snapshotDialog = qEnvironmentVariable("MEMGRAPH_UI_SNAPSHOT_DIALOG");
        if (snapshotDialog == QStringLiteral("settings")) {
            snapshotTarget = new SettingsDialog(&settings, &secretStore, &window);
            snapshotTarget->show();
        } else if (snapshotDialog == QStringLiteral("templates")) {
            snapshotTarget = new TemplateDialog(&store, &window);
            snapshotTarget->show();
        }
        QTimer::singleShot(500, snapshotTarget, [&app, snapshotTarget, snapshotPath]() {
            snapshotTarget->grab().save(snapshotPath);
            app.quit();
        });
    }
    return app.exec();
}
