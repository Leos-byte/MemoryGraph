#pragma once

#include <QDesktopServices>
#include <QTextBrowser>

class SafeMarkdownBrowser : public QTextBrowser {
public:
    explicit SafeMarkdownBrowser(QWidget *parent = nullptr) : QTextBrowser(parent)
    {
        setOpenLinks(false);
        setOpenExternalLinks(false);
        connect(this, &QTextBrowser::anchorClicked, this, [this](const QUrl &url) {
            if (url.isRelative() && url.path().isEmpty() && url.hasFragment()) {
                scrollToAnchor(url.fragment());
            } else if (isWebLink(url)) {
                QDesktopServices::openUrl(url);
            }
        });
    }

    static bool isWebLink(const QUrl &url)
    {
        return url.isValid() && !url.host().isEmpty() && url.userInfo().isEmpty()
            && (url.scheme() == QStringLiteral("https") || url.scheme() == QStringLiteral("http"));
    }

    QVariant loadResource(int, const QUrl &) override
    {
        // Model-generated Markdown must never read local files or fetch remote images.
        return QByteArray();
    }
};
