#include "api/AiClient.h"
#include "core/TemplateEngine.h"
#include "core/GraphStore.h"
#include "core/TextSanitizer.h"

#include <QFile>
#include <QTemporaryDir>
#include <QProcess>
#include <QtTest/QtTest>

class TemplateEngineTest : public QObject {
    Q_OBJECT

private slots:
    void rejectsInsecureApiEndpoints()
    {
        QVERIFY(AiClient::isSecureBaseUrl(QStringLiteral("https://api.openai.com/v1")));
        QVERIFY(AiClient::isSecureBaseUrl(QString()));
        AiClient client;
        QSignalSpy failed(&client, &AiClient::generationFailed);
        for (const QString &url : {QStringLiteral("http://example.com"), QStringLiteral("file:///tmp/api"),
                                  QStringLiteral("https://user:secret@example.com"),
                                  QStringLiteral("https://example.com?token=value"), QStringLiteral("https://example.com#fragment")}) {
            QVERIFY(!AiClient::isSecureBaseUrl(url));
            AiRequest request;
            request.apiKey = QStringLiteral("not-a-real-key");
            request.baseUrl = url;
            client.generateExplanation(request);
        }
        QCOMPARE(failed.count(), 5);
    }

    void insertedVariablesRemainLiteral()
    {
        PromptTemplate prompt;
        prompt.userPrompt = QStringLiteral("{{concept}} / {{language}}");
        TemplateContext context;
        context.concept = QStringLiteral("{{context_markdown}}");
        context.contextMarkdown = QStringLiteral("private context");
        context.language = QStringLiteral("English");
        QCOMPARE(TemplateEngine().render(prompt, context).second, QStringLiteral("{{context_markdown}} / English"));
    }

    void cancellationDisconnectsProcessCallbacks()
    {
        AiClient client;
        auto *process = new QProcess(&client);
        bool called = false;
        connect(process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished), &client,
                [&called]() { called = true; });
        process->start(QStringLiteral("sleep"), {QStringLiteral("30")});
        QVERIFY(process->waitForStarted());
        client.cancelAll();
        QCOMPARE(process->state(), QProcess::NotRunning);
        QVERIFY(!called);
    }

    void convertsAuthenticationModes()
    {
        QCOMPARE(authModeToString(AuthMode::ApiKey), QStringLiteral("api_key"));
        QCOMPARE(authModeToString(AuthMode::ChatGptLogin), QStringLiteral("chatgpt_login"));
        QCOMPARE(authModeFromString(QStringLiteral("chatgpt_login")), AuthMode::ChatGptLogin);
        QCOMPARE(authModeFromString(QStringLiteral("unknown")), AuthMode::ApiKey);
    }

    void generatesThroughChatGptLoginBackend()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        const QString fakeCodexPath = tempDir.filePath(QStringLiteral("codex"));
        QFile fakeCodex(fakeCodexPath);
        QVERIFY(fakeCodex.open(QIODevice::WriteOnly | QIODevice::Text));
        fakeCodex.write(
            "#!/bin/sh\n"
            "output=''\n"
            "model=''\n"
            "shell_disabled=0\n"
            "sandbox=''\n"
            "while [ \"$#\" -gt 0 ]; do\n"
            "  if [ \"$1\" = '--output-last-message' ]; then shift; output=\"$1\"; fi\n"
            "  if [ \"$1\" = '--model' ]; then shift; model=\"$1\"; fi\n"
            "  if [ \"$1\" = 'features.shell_tool=false' ]; then shell_disabled=1; fi\n"
            "  if [ \"$1\" = '--sandbox' ]; then shift; sandbox=\"$1\"; fi\n"
            "  shift\n"
            "done\n"
            "if [ \"$model\" != 'gpt-5.5' ]; then exit 17; fi\n"
            "if [ \"$shell_disabled\" != '1' ] || [ \"$sandbox\" != 'read-only' ]; then exit 18; fi\n"
            "cat >/dev/null\n"
            "printf '\\033[31m# Generated\\033[0m\\n\\nFlow: A → B 🚀' >\"$output\"\n");
        fakeCodex.close();
        QVERIFY(QFile::setPermissions(fakeCodexPath,
                                      QFileDevice::ReadOwner | QFileDevice::WriteOwner | QFileDevice::ExeOwner));

        const QByteArray originalPath = qgetenv("PATH");
        qputenv("PATH", tempDir.path().toUtf8() + ':' + originalPath);

        AiClient client;
        QSignalSpy finishedSpy(&client, &AiClient::generationFinished);
        QSignalSpy failedSpy(&client, &AiClient::generationFailed);
        AiRequest request;
        request.nodeId = 42;
        request.model = QStringLiteral("gpt-5.5");
        request.authMode = AuthMode::ChatGptLogin;
        request.systemPrompt = QStringLiteral("System instructions");
        request.userPrompt = QStringLiteral("Explain memory");
        client.generateExplanation(request);

        const bool generated = finishedSpy.count() > 0 || finishedSpy.wait(5000);
        qputenv("PATH", originalPath);

        QVERIFY(generated);
        QCOMPARE(finishedSpy.count(), 1);
        QCOMPARE(failedSpy.count(), 0);
        const QList<QVariant> arguments = finishedSpy.takeFirst();
        QCOMPARE(arguments.at(0).toLongLong(), 42);
        QCOMPARE(arguments.at(1).toString(), QStringLiteral("# Generated\n\nFlow: A -> B"));
    }

    void stripsChunkedTerminalFormatting()
    {
        QString raw = QStringLiteral("Welcome to Codex [v\x1B[90");
        QCOMPARE(TextSanitizer::stripTerminalSequences(raw), QStringLiteral("Welcome to Codex [v"));

        raw.append(QStringLiteral("m0.149.1\x1B[0m]\n\x1B[90mOpenAI's command-line coding agent\x1B[0m"));
        QCOMPARE(TextSanitizer::stripTerminalSequences(raw),
                 QStringLiteral("Welcome to Codex [v0.149.1]\nOpenAI's command-line coding agent"));
    }

    void replacesAllSupportedVariables()
    {
        PromptTemplate promptTemplate;
        promptTemplate.systemPrompt = QStringLiteral("{{concept}} {{language}} {{map_title}}");
        promptTemplate.userPrompt = QStringLiteral("{{selected_text}} {{parent_concept}} {{context_markdown}}");

        TemplateContext context;
        context.concept = QStringLiteral("Memory");
        context.selectedText = QStringLiteral("Encoding");
        context.parentConcept = QStringLiteral("Learning");
        context.mapTitle = QStringLiteral("Cognitive Science");
        context.contextMarkdown = QStringLiteral("Existing notes");
        context.language = QStringLiteral("English");

        TemplateEngine engine;
        const auto rendered = engine.render(promptTemplate, context);

        QCOMPARE(rendered.first, QStringLiteral("Memory English Cognitive Science"));
        QCOMPARE(rendered.second, QStringLiteral("Encoding Learning Existing notes"));
    }

    void createsMapWithEmptyDescription()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        GraphStore store;
        QString error;
        QVERIFY2(store.open(tempDir.path() + QStringLiteral("/memgraph.sqlite3"), &error), qPrintable(error));

        const MapRecord map = store.createMap(QStringLiteral("Test Map"), &error);
        QVERIFY2(map.id > 0, qPrintable(error));
        QCOMPARE(map.title, QStringLiteral("Test Map"));
        QCOMPARE(map.description, QStringLiteral(""));

        const QList<MapRecord> maps = store.maps(&error);
        QCOMPARE(maps.size(), 1);
        QCOMPARE(maps.first().description, QStringLiteral(""));
        const auto permissions = QFile::permissions(tempDir.path() + QStringLiteral("/memgraph.sqlite3"));
        QVERIFY(!(permissions & (QFileDevice::ReadGroup | QFileDevice::WriteGroup | QFileDevice::ReadOther | QFileDevice::WriteOther)));
        const QString maliciousTitle = QStringLiteral("'); DROP TABLE maps; --");
        const auto quotedMap = store.createMap(maliciousTitle, &error);
        QVERIFY2(quotedMap.id > 0, qPrintable(error));
        QCOMPARE(quotedMap.title, maliciousTitle);
        QCOMPARE(store.maps().size(), 2);
    }

    void deletesNodeAndConnectedEdges()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        GraphStore store;
        QString error;
        QVERIFY2(store.open(tempDir.path() + QStringLiteral("/memgraph.sqlite3"), &error), qPrintable(error));

        const MapRecord map = store.createMap(QStringLiteral("Delete Test"), &error);
        QVERIFY2(map.id > 0, qPrintable(error));

        const NodeRecord parent = store.createNode(map.id, QStringLiteral("Parent"), QStringLiteral("Parent body"), 0, 0, 0, QStringLiteral("ready"), &error);
        QVERIFY2(parent.id > 0, qPrintable(error));
        const NodeRecord child = store.createNode(map.id, QStringLiteral("Child"), QStringLiteral("Child body"), 0, 100, 100, QStringLiteral("ready"), &error);
        QVERIFY2(child.id > 0, qPrintable(error));
        const EdgeRecord edge = store.createEdge(map.id, parent.id, child.id, QStringLiteral("explains"), QStringLiteral("selected"), &error);
        QVERIFY2(edge.id > 0, qPrintable(error));

        QVERIFY2(store.deleteNode(parent.id, &error), qPrintable(error));

        const QList<NodeRecord> nodes = store.nodes(map.id, &error);
        QCOMPARE(nodes.size(), 1);
        QCOMPARE(nodes.first().id, child.id);
        QCOMPARE(store.edges(map.id, &error).size(), 0);

        const QList<NodeRecord> deletedNodes = store.deletedNodes(map.id, &error);
        QCOMPARE(deletedNodes.size(), 1);
        QCOMPARE(deletedNodes.first().id, parent.id);

        QVERIFY2(store.restoreNode(parent.id, &error), qPrintable(error));
        QCOMPARE(store.nodes(map.id, &error).size(), 2);
        QCOMPARE(store.deletedNodes(map.id, &error).size(), 0);
        QCOMPARE(store.edges(map.id, &error).size(), 1);
    }

    void updatesRelationDescription()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        GraphStore store;
        QString error;
        QVERIFY2(store.open(tempDir.path() + QStringLiteral("/memgraph.sqlite3"), &error), qPrintable(error));

        const MapRecord map = store.createMap(QStringLiteral("Relation Test"), &error);
        QVERIFY2(map.id > 0, qPrintable(error));
        const NodeRecord source = store.createNode(map.id, QStringLiteral("Source"), QStringLiteral("Source body"), 0, 0, 0, QStringLiteral("ready"), &error);
        QVERIFY2(source.id > 0, qPrintable(error));
        const NodeRecord target = store.createNode(map.id, QStringLiteral("Target"), QStringLiteral("Target body"), 0, 100, 100, QStringLiteral("ready"), &error);
        QVERIFY2(target.id > 0, qPrintable(error));

        const EdgeRecord edge = store.createEdge(map.id, source.id, target.id, QStringLiteral("manual"), QStringLiteral("old"), &error);
        QVERIFY2(edge.id > 0, qPrintable(error));
        QVERIFY2(store.updateEdgeLabel(edge.id, QStringLiteral("new relation"), &error), qPrintable(error));

        const QList<EdgeRecord> edges = store.edges(map.id, &error);
        QCOMPARE(edges.size(), 1);
        QCOMPARE(edges.first().label, QStringLiteral("new relation"));

        const EdgeRecord duplicate = store.createEdge(map.id, source.id, target.id, QStringLiteral("manual"), QStringLiteral("updated duplicate"), &error);
        QVERIFY2(duplicate.id == edge.id, qPrintable(error));
        QCOMPARE(duplicate.label, QStringLiteral("updated duplicate"));
        const QList<EdgeRecord> updatedEdges = store.edges(map.id, &error);
        QCOMPARE(updatedEdges.size(), 1);
        QCOMPARE(updatedEdges.first().label, QStringLiteral("updated duplicate"));
    }

    void movesMapToTrashAndEmptiesTrash()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        GraphStore store;
        QString error;
        QVERIFY2(store.open(tempDir.path() + QStringLiteral("/memgraph.sqlite3"), &error), qPrintable(error));

        const MapRecord map = store.createMap(QStringLiteral("Delete Map Test"), &error);
        QVERIFY2(map.id > 0, qPrintable(error));
        const NodeRecord source = store.createNode(map.id, QStringLiteral("Source"), QStringLiteral("Source body"), 0, 0, 0, QStringLiteral("ready"), &error);
        QVERIFY2(source.id > 0, qPrintable(error));
        const NodeRecord target = store.createNode(map.id, QStringLiteral("Target"), QStringLiteral("Target body"), 0, 100, 100, QStringLiteral("ready"), &error);
        QVERIFY2(target.id > 0, qPrintable(error));
        const EdgeRecord edge = store.createEdge(map.id, source.id, target.id, QStringLiteral("manual"), QStringLiteral("relation"), &error);
        QVERIFY2(edge.id > 0, qPrintable(error));

        QVERIFY2(store.deleteMap(map.id, &error), qPrintable(error));
        QCOMPARE(store.maps(&error).size(), 0);
        QCOMPARE(store.deletedMaps(&error).size(), 1);
        QCOMPARE(store.nodes(map.id, &error).size(), 2);

        QVERIFY2(store.restoreMap(map.id, &error), qPrintable(error));
        QCOMPARE(store.maps(&error).size(), 1);
        QCOMPARE(store.deletedMaps(&error).size(), 0);

        QVERIFY2(store.deleteMap(map.id, &error), qPrintable(error));
        QVERIFY2(store.emptyTrash(&error), qPrintable(error));
        QCOMPARE(store.deletedMaps(&error).size(), 0);
        QCOMPARE(store.nodes(map.id, &error).size(), 0);
    }

    void movesTemplateToTrashAndRestoresIt()
    {
        QTemporaryDir tempDir;
        QVERIFY(tempDir.isValid());

        GraphStore store;
        QString error;
        QVERIFY2(store.open(tempDir.path() + QStringLiteral("/memgraph.sqlite3"), &error), qPrintable(error));

        const PromptTemplate originalDefault = store.defaultTemplate(&error);
        QVERIFY2(originalDefault.id > 0, qPrintable(error));

        const PromptTemplate custom = store.createTemplate(QStringLiteral("Custom Template"),
                                                           QStringLiteral("System {{language}}"),
                                                           QStringLiteral("Explain {{concept}}"),
                                                           false,
                                                           &error);
        QVERIFY2(custom.id > 0, qPrintable(error));
        QCOMPARE(store.templates(&error).size(), 2);

        QVERIFY2(store.deleteTemplate(custom.id, &error), qPrintable(error));
        QCOMPARE(store.templates(&error).size(), 1);
        QCOMPARE(store.deletedTemplates(&error).size(), 1);
        QCOMPARE(store.deletedTemplates(&error).first().id, custom.id);

        QVERIFY2(store.restoreTemplate(custom.id, &error), qPrintable(error));
        QCOMPARE(store.templates(&error).size(), 2);
        QCOMPARE(store.deletedTemplates(&error).size(), 0);

        QVERIFY2(store.deleteTemplate(custom.id, &error), qPrintable(error));
        QVERIFY2(store.emptyTrash(&error), qPrintable(error));
        QCOMPARE(store.deletedTemplates(&error).size(), 0);
        QCOMPARE(store.templates(&error).size(), 1);
    }
};

QTEST_MAIN(TemplateEngineTest)
#include "test_template_engine.moc"
