# Security Audit - 2026-10-26

Scope: active Qt/C++ source, network and Codex backends, Markdown rendering,
SQLite storage, template expansion, packaging, and files prepared for GitHub.
This is a source review with targeted regression tests, not a penetration test
or a guarantee that all vulnerabilities have been eliminated.

## Findings And Fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | An HTTP API endpoint could expose the bearer key and knowledge content to network interception. | Both Settings and the API backend require HTTPS, reject embedded credentials/query/fragment, and block redirects. |
| High | Changing the API service could reuse the previous service's key. | Clear the key field whenever endpoint scheme, host, or port changes. |
| High | QTextBrowser could load local images and dispatch links to arbitrary installed protocol handlers. | SafeMarkdownBrowser blocks resource loading and default navigation, permits only explicit HTTP/HTTPS clicks and in-document anchors. |
| High | Codex was instructed by a prompt to avoid tools, but its command tools remained enabled. | Disable shell, image viewing, apps, plugins, browser/computer use, hooks, code mode, and subagents; disable web search, ignore user config/rules, retain read-only sandbox and never approve commands. |
| High | A pending generation could write to the same numeric node ID after switching databases. | Cancel backend work before opening another database and ignore callbacks without an active pending request. |
| Medium | API replies and generation processes had no resource/time bounds. | API response limit 4 MiB and total timeout 120 seconds; Codex timeout 10 minutes, bounded retained diagnostics and output file reads. |
| Medium | SQLite files could inherit group/world-readable permissions. | Owner-only database and existing journal/WAL/SHM permissions; restrictive Unix application umask. |
| Medium | Sequential placeholder substitution expanded placeholder-looking user content a second time. | Single-pass substitution leaves inserted values literal. |
| Medium | Source publication/backup exclusions missed some credentials and runtime artifacts. | Exclude runtime databases and sidecars, credentials, environment files, build outputs, backups, and unpacked releases from Git; exclude credentials and runtime data from source backups. |

SQL queries use bound parameters; a malicious-looking map title is covered by a
regression test. API error messages redact the current key before display/storage.
Credentials continue to use Secret Service when available and session memory
otherwise; they are not stored in SQLite.

## Validation

- Release x64 build and two CTest suites: core/backend and security UI tests.
- Tests cover rejected unsafe endpoints, literal variable replacement, cancellation
  disconnecting callbacks, Codex model/tool settings, local-image blocking, link
  scheme restrictions, database permissions, SQL parameter binding, and prior CRUD flows.
- Common credential-pattern scan of publishable source files: no matches.
- Translation XML and shell syntax validation.
- Mock Codex tests do not contact OpenAI or consume paid model requests.

## System Dependencies: Updates Required

Installed during the audit: Qt 6.11.1-1.fc44, OpenSSL 3.5.7-1.fc44,
SQLite 3.51.2-1.fc44, CA certificates 2025.2.80_v9.0.304-7.fc44.
Cached Fedora security advisories report these available updates:

| Dependency | Advisory | Severity | Available Version |
| --- | --- | --- | --- |
| CA certificates | FEDORA-2026-0609e13c0d | Critical | 2026.2.92_v9.0.319-2.fc44 |
| OpenSSL libraries | FEDORA-2026-12f3f3d569 | Important | 3.5.9-1.fc44 |
| SQLite libraries | FEDORA-2026-4bc86fb6d0 | Important | 3.51.2-2.fc44 |

The attempted targeted upgrade could not proceed because sudo requires the user's
password. Run in a terminal:

```bash
sudo dnf upgrade --security -y openssl-libs sqlite-libs ca-certificates
```

The fresh metadata refresh encountered a Fedora mirror TLS error, so these findings
use cached repository metadata. Recheck after updating. MemGraph links system
libraries; local release packages do not include replacements for these libraries.

## Boundaries And Remaining Risks

- A configured API provider receives prompts, selected parent content, and the
  API key deliberately supplied for that provider. HTTPS does not establish provider trust.
- Codex remains an external, authenticated program. Tool flags reduce exposed
  capabilities but do not create an OS-level confidentiality boundary; keep Codex
  updated and use a trusted installation. No live tool-escape test was performed.
- SQLite data, generated notes, and prompt history remain unencrypted at rest.
  Owner permissions protect against other ordinary accounts, not root or software
  running as the same user. Prefer full-disk encryption for sensitive notes.
- Resource limits mitigate oversized replies; they are not a comprehensive CPU,
  disk, or renderer sandbox for hostile content.
- Request cancellation has a backend regression test; database-switch callback
  wiring was reviewed, not exercised by a full interactive GUI integration test.

References: [Qt QTextBrowser](https://doc.qt.io/qt-6/qtextbrowser.html),
[OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
