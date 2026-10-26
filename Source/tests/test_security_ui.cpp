#include "ui/SafeMarkdownBrowser.h"
#include <QImage>
#include <QTemporaryDir>
#include <QtTest>

class SecurityUiTest : public QObject {
    Q_OBJECT
private slots:
    void blocksLocalImageReads()
    {
        QTemporaryDir directory;
        QVERIFY(directory.isValid());
        const QString path = directory.filePath(QStringLiteral("private.png"));
        QImage image(2, 2, QImage::Format_RGB32);
        image.fill(Qt::red);
        QVERIFY(image.save(path));
        SafeMarkdownBrowser browser;
        const QUrl url = QUrl::fromLocalFile(path);
        browser.setMarkdown(QStringLiteral("![private](%1)").arg(url.toString()));
        const QVariant resource = browser.document()->resource(QTextDocument::ImageResource, url);
        QVERIFY(!resource.canConvert<QImage>());
        QVERIFY(resource.toByteArray().isEmpty());
        QVERIFY(!browser.openLinks());
        QVERIFY(!browser.openExternalLinks());
        QCOMPARE(browser.toPlainText().contains(QStringLiteral("private.png")), false);
    }

    void restrictsLinkSchemes()
    {
        QVERIFY(SafeMarkdownBrowser::isWebLink(QUrl(QStringLiteral("https://example.com/docs"))));
        for (const QString &url : {QStringLiteral("file:///etc/passwd"), QStringLiteral("javascript:alert(1)"),
                                  QStringLiteral("vscode://file/tmp/test"), QStringLiteral("relative.md"),
                                  QStringLiteral("https://user:password@example.com")}) {
            QVERIFY2(!SafeMarkdownBrowser::isWebLink(QUrl(url)), qPrintable(url));
        }
    }
};
QTEST_MAIN(SecurityUiTest)
#include "test_security_ui.moc"
