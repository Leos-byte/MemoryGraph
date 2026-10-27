# Electron Migration Acceptance

Target: **MemGraph 0.2.0-beta.1**, Windows x64 (NSIS + zip) and Linux x64 (AppImage + tar.gz). Use synthetic content and an isolated test data directory. Never test migrations/restores on the only copy of a user's data. A checked box requires observed evidence, not an implemented feature or a workflow file.

## Evidence Record

| Field | Record before approving release |
| --- | --- |
| Tag / full commit SHA | Migration build: `865460991f1b2212940d89c3654d32e3469eb12a`; no Electron release tag yet |
| Tester / date | Automated agent validation, 2026-10-26/27 |
| Windows version / architecture | Windows Server 2022 x64 hosted runner; Windows 10/11 installation not run |
| Linux distribution / architecture | Fedora 44 x64 local; Ubuntu 22.04 x64 hosted CI |
| Windows CI run / artifacts | Passed: https://github.com/Leos-byte/MemoryGraph/actions/runs/40432043548; `ci-packages-windows-x64`, `ci-unpacked-windows-x64` |
| Ubuntu 22.04 CI run / artifacts | Passed: https://github.com/Leos-byte/MemoryGraph/actions/runs/40432043548; `ci-packages-linux-x64`, `ci-unpacked-linux-x64` |
| Real package smoke / upgrade evidence | Linux unpacked and final AppImage start/SQLite/graph/isolation checks passed using synthetic profiles. AppImage used extract-and-run; actual installed N-to-N+1 replacement and FUSE mode remain untested. |
| Known limitations / release notes | Windows publisher is unsigned; real provider/login, OS credential backend, NSIS installation and installed cross-version update checks remain manual release gates |

Both hosted jobs passed 47 release-tool tests, 45 unit tests, five real Electron UI scenarios and an isolated unpacked-application smoke test, and built their two package formats. These checks do not establish that NSIS installation, OS credentials, or an installed **N-to-N+1 upgrade** works. That upgrade has not been tested by this task. Record unavailable tests as **not run**, not passed. Do not attach private screenshots, graphs, tokens, databases, or raw provider logs as evidence.

The downloaded artifacts from run `40432043548` are retained under `Releases/0.2.0-beta.1-ci-40432043548`: `packages`, `linux-unpacked`, and `win-unpacked`. Both downloaded Linux formats also passed local isolated startup checks. Seven real assets were signed locally and independently verified; this did not create or publish a GitHub Release. A subsequent standalone CLI regression adds one release-tool test (48 total). See `test/electron-acceptance-20261027.md`.

## Automated Gates

- [x] `npm ci` works from the committed lockfile on both clean hosted runners.
- [x] `node --test DevScripts/tests/*.test.mjs` passes on Windows and Ubuntu 22.04.
- [x] `npm run typecheck`, `npm run test`, and `npm run build` pass on both platforms.
- [x] `npm run test:e2e` passes on Windows and under `xvfb-run -a` on Linux, without repository secrets or paid provider access.
- [ ] `npm run verify` passes on the target desktop or via `verify_electron` wrapper. Main entry `dist-main/main.cjs` launches the built renderer, not a development web server.
- [x] Both `npm run package:dir -- --publish never` and `npm run package -- --publish never` pass. Exact four x64 formats and updater YAML files exist in the combined platform artifacts (`beta*.yml` for beta, `latest*.yml` for stable).
- [x] CI uploads package and mode-preserving unpacked artifacts. Test diagnostics contain only synthetic fixture data.

## Desktop And Data

- [ ] Clean launch from each **downloaded package** displays a usable window, no blank renderer, console crash, or missing SQLite native module.
- [ ] NSIS install/uninstall works for a normal Windows user; reinstall/upgrade preserves user data. Windows zip starts after extraction and does not promise auto-install updates.
- [ ] Linux AppImage starts with the target machine's FUSE setup; tar.gz starts after extraction with executable modes intact. Record any system library requirements.
- [ ] Create/rename/delete a map; create/edit/move/delete nodes; pan/zoom/select; close and restart; persisted titles, positions, content, and edges remain correct.
- [ ] Recycle/restore/empty operations handle confirmation and persistence. Markdown copy/export produces the expected content without keys.
- [ ] Select unfamiliar text and create a connected child; edit a relation; regenerate relationship text without duplicate sections or corrupting unrelated content.
- [ ] Chinese and English UI, keyboard focus, dialogs, long labels, and window resizing remain usable without overlapping text.
- [ ] Data directory selection, backup, import, and restore behave correctly, including cancellation, corrupt input, existing destination, Unicode/space-containing paths, and restart. Existing Qt data is backed up and compatibility is tested, not assumed.
- [ ] No script cleans the local `Backup`/`Releases` directories or overwrites real user data. Qt archive/tag stays recoverable independently of Electron builds.

## Providers And Security

- [ ] Mocked streaming response updates the correct node; cancellation and retry are safe; switching data during a request cannot write into the wrong database.
- [ ] Offline mode, rejected credentials, rate limits, malformed response, process exit, and timeout show actionable failure states without losing content.
- [ ] API endpoints reject unsafe protocols/embedded credentials. External links and Markdown cannot read local secrets or invoke arbitrary privileged IPC.
- [ ] Key storage is tested on the actual Windows/Linux credential backend; an unavailable backend fails safely or falls back to session-only storage as designed.
- [ ] Keys and provider/Codex credentials are absent from SQLite, exports, backups, diagnostics, feedback, and release artifacts.
- [ ] Optional real-provider/login smoke is explicitly consented and performed outside public CI. Record only redacted outcomes, not credentials or private conversations.

## Feedback

- [ ] GitHub feedback opens the browser, selects `bug.yml`, and pre-fills the `environment` field; it does not create an issue automatically.
- [ ] Version, OS, steps, expected and actual behavior can be supplied in English or Chinese. Optional evidence/email is not required to submit.
- [ ] The user can inspect/redact all feedback before sending; only deliberately selected content is included, not automatic database/log uploads.
- [ ] Email opens a draft to `leo.oceanai@gmail.com`; no silent send occurs. Copy feedback works when browser/mail handlers are unavailable.

## Signing And Updates

- [x] The actual packaged resources include the intended Ed25519 `update-public-key.pem` (both downloaded unpacked builds; compare parsed keys because Windows checkout uses CRLF).
- [ ] A missing signing secret does not break ordinary builds but blocks the signing/publish path. Missing public key and mismatched key pair also block publication.
- [x] `release-manifest.json` and `release-manifest.sig` verify against the bundled key, covering all four packages, both updater YAML files, and matching optional blockmaps (local reviewed CI artifacts, not yet a GitHub Release).
- [ ] Modified manifest, invalid signature, missing coverage, altered package size/hash, duplicate asset, unexpected file, and wrong channel/version are rejected before upload/install.
- [ ] Installed NSIS/AppImage checks beta/stable channel correctly; no silent download/install, downgrade, or unverified update occurs. Portable zip/tar builds give a clear unsupported/manual update path.
- [ ] On a test prerelease, the previous installed version discovers/downloads/verifies the update; install/relaunch preserves data. Repeat rejection testing with controlled tampered metadata. A draft alone cannot prove this flow.
- [ ] Release notes distinguish signed update metadata from OS code-signing. No Windows publisher trust is claimed without Authenticode evidence.

## Publication Approval

- [x] Repository visibility is public, MIT license is present, and maintainer contact is correct.
- [ ] Manual dispatch is on `main`; tag, full SHA, package version, and lockfile versions match. Protect release tags and avoid moving `main` during the run.
- [ ] Only the final publish job has `contents: write`; PR checks receive no secrets. Signing secret is scoped to signing, not building/publishing.
- [ ] Workflow infers beta/stable from the validated version and creates only a draft (prerelease for beta, non-prerelease for stable); assets come from the same run. It rejects already-published releases and moved refs; maintainers do not change refs or publish while an upload is running.
- [ ] Review all downloaded release artifacts, manual smoke evidence, known limitations, and notes before a maintainer explicitly publishes the draft. No auto-merge or issue-triggered execution is enabled.
