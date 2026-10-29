# Project Plan

## 1.0.0-beta.1 - Major Release And Backup Retention

Status: Complete. Public v1.0.0-beta.1 at `2026-10-29T12:54:56Z`; PR #6/CI `40833451157`, tag `ff0635e1abf9ad5122ab2ad5f434846fe1b44a18`, release run `40875526528`. New backup retained; all seven allowlisted historical directories deleted, protected key/database preserved. See `test/release-1.0.0-beta.1.md`.

- [x] Inspect version, release guards, remote main/tags and local backup contents.
- [x] Prepare matching package/lock metadata and release notes combining Calico and updater work.
- [x] Verify locally, submit PR, require successful Windows/Linux CI and merge the reviewed source.
- [x] Tag the tested main, build/sign a draft, verify assets/notes and publish the requested release.
- [x] Retain new exact source/compiled backup and Linux unpacked manual-test app, then delete only inventoried historical Backup directories.
- [x] Preserve `Backup/update-signing-private.pem`, the independent Qt SQLite backup, runtime data and GitHub historical releases. Record deletion results; do not run broad Backup cleanup.

## 2026-10-29 - Calico UI (Unreleased)

Status: Implemented and verified locally: typecheck/build, 129 units, 56 release-tool tests, all 17 desktop scenarios and retained Linux package smoke passed. Existing updater work is preserved. No release/push performed. Evidence: `test/calico-20261029.md`.

- [x] Inspect React/custom CSS/React Flow structure and confirm a single light replacement theme.
- [x] Centralize colors and shared dimensions; separate primary fills, readable accents and semantic statuses.
- [x] Restyle workbench, graph, Markdown, dialogs, templates, feedback and updater surfaces without changing business commands.
- [x] Improve narrow drawers/template layout, navigation accessible names and reduced-motion camera controls.
- [x] Finish computed-color, responsive, desktop regression and package smoke checks; retain screenshots and local test app.
- [ ] Windows desktop and real installed upgrades remain external manual gates; no release/push is part of this UI task.

## 2026-10-29 - Manual And Automatic Updates (Unreleased)

Status: Implemented and verified locally: typecheck/build, 129 unit tests, 56 release-tool tests, 14 desktop scenarios, screenshot inspection and isolated Linux unpacked smoke. The public beta.4 release and its tag/assets remain unchanged. No release or repository push is included in this request. Evidence: `test/updates-20261029.md`.

- [x] Inspect the existing signed updater and preserve GitHub hosting, data backups and explicit restart consent.
- [x] Add persisted manual/check-only/check-and-download modes, delayed startup and six-hour polling, and shutdown cleanup.
- [x] Expose settings/manual entry points, background progress/readiness, installation confirmation and portable-build fallback in both languages.
- [x] Guard concurrent actions/channel changes, re-disable downgrade after channel selection, and distinguish current-version/error states.
- [x] Finish unit, desktop and simulated installer-control regressions; inspect narrow/desktop screenshots.
- [x] Build/smoke a separately named Linux unpacked development app and retain it for manual testing.
- [ ] Real Windows NSIS / Linux AppImage N-to-N+1 installation remains a manual acceptance gate, not established by mocked updater tests.

## 0.2.0-beta.4 - Current Model Catalog

Status: Published at `2026-10-28T14:32:24Z`. PR #5 merged/tagged at `c99011580bbe46e80544c9131e417e3d4a619a58`; PR CI `40683763704` passed after one Windows native-install retry. Release run `40704949356` passed validation, both builds, signing and draft upload on its first attempt. Saved profiles and earlier assets remain intact; R2 stays off. See `test/models-release-20261028.md`.

- [x] Verify official API IDs and Codex model availability documentation; preserve legacy/custom settings and provider boundaries.
- [x] Implement shared model catalog, fresh-profile default and bilingual Flash alias label.
- [x] Run local types/build, 94 unit tests, 56 release-tool tests and all 10 desktop scenarios. Refresh final settings screenshots after transient notices disappear.
- [x] Pass Windows/Linux PR CI, merge and tag the tested main.
- [x] Run manual release/sign/upload, independently verify draft metadata, publish beta.4 and record evidence. R2 stays off.
- [x] Retain tagged source/compiled backups and a clearly labeled local unpacked test build; it is not claimed byte-identical to hosted packages.

## 0.2.0-beta.3 - GitHub Prerelease

Status: Published at `2026-10-28T08:52:39Z` after PR #4 CI `40644999331` and release run `40653746249` passed. Tag/target is `3f6bfbd0a5da77b917d3a72c8e43cace18b2a4a1`. Beta.2/tag/assets remain unchanged; R2 remains unconfigured and disabled. See `test/release-20261028.md`.

- [x] Prepare matching package/lock versions and release notes without dependency updates.
- [x] Pass Windows/Linux CI and merge the version-preparation PR #4.
- [x] Tag the tested current main and run the existing manual release workflow.
- [x] Verify all signed asset bytes in CI, independently verify downloaded metadata, and publish the reviewed nine-file GitHub prerelease. Preserve exact tagged source and the hash-verified Linux compiled archive/extracted manual-test copy locally; the full Windows/Linux installer bundle was not mirrored locally.
- [x] Record final run/SHA/artifact evidence. Real providers, OS installation and installed N-to-N+1 updating were not tested.

## 0.2.0-beta.3 - R2 Mirror (PR #2)

Status: PR #2 merged at `2cfbef3` after Windows/Linux CI `40640158562` passed; its code is included in beta.3. Live R2 activation remains deferred by the owner and requires credentials/domain setup. All 56 release-tool tests passed locally; deployment is not claimed by mocked tests.

- [x] Diagnose the failed workflow policy test and allow release triggers only for this mirror.
- [x] Restrict upstream events and trusted checkout, scope credentials to upload, verify signatures/hashes before writes, and publish the manifest last.
- [x] Keep automatic mirroring opt-in; document setup, costs, retries and public verification in `docs/r2_mirror.md`.
- [x] Keep hosted Windows/Linux CI as the merge gate and track its result in the original PR #2: https://github.com/Leos-byte/MemoryGraph/pull/2 .
- [ ] Owner configures bucket/domain and three R2 Secrets; run a manual beta.2 backfill, verify public downloads, then enable `R2_MIRROR_ENABLED`.

## 0.2.0-beta.3 - PR Review Fixes

Status: Implementation and local verification complete (typecheck, build, 73 Linux unit tests, 8 desktop scenarios and 48 release-tooling tests). Repair submitted in [PR #3](https://github.com/Leos-byte/MemoryGraph/pull/3); the linked PR records the authoritative hosted CI and merge outcome.

- [x] Route normal settings and imported Qt settings through the same endpoint validation and key-clearing policy.
- [x] Validate imported settings before database replacement and preserve credentials for unchanged origins.
- [x] Use independent UTF-8 decoders for Codex stdout and stderr.
- [x] Add unit and UI regressions using test-only keys and no external model requests.
- [x] Run local typecheck, build, unit tests and desktop E2E. The earlier environment-blocked GUI run was superseded by an approved successful run on 2026-10-28.
- [x] Merge the separate repair PR #3 after Windows/Linux CI passed (`40629772669`); local main synchronized to `d92180e`. PR #2 was left unchanged during that task and is now covered by the newer owner request above.

## 0.2.0-beta.2 - Login Lifecycle Fix

Status: Released as public prerelease v0.2.0-beta.2 on 2026-10-27. Release run `40453434325` passed both platforms; remaining manual upgrade/OS checks are not claimed complete.

- [x] Reproduce the frontend treating a login-start acknowledgement as completed login.
- [x] Reuse an active login, restore progress after reopening Settings, and ignore stale session callbacks.
- [x] Add cancellation, timeout recovery and reliable child-process termination.
- [x] Add mock-only concurrent/reopen/cancel/retry/localization tests without real credentials or provider calls.
- [x] Bump package and lockfile to 0.2.0-beta.2; preserve older packages and data.
- [x] Verify Linux unpacked/AppImage startup and retain packages plus `Releases/MemGraph-v0.2.0-beta.2-linux-x64-unpacked` for manual testing.
- [x] Confirm Windows/Linux hosted login regression checks (run `40451125499` at `9737b47`); subsequent PR checks remain the merge gate.

## Electron Migration - 0.2.0-beta.1

Status: Implemented and merged through PR #1. First public Electron release is v0.2.0-beta.2; installed-upgrade acceptance remains pending before stable promotion.

- [x] Freeze Qt source/release and preserve a private SQLite snapshot.
- [x] Migrate core learning, templates, providers, Markdown and recycle bin.
- [x] Implement restricted IPC, safe credentials and consistent database import.
- [x] Add browser GitHub feedback and mailto email feedback.
- [x] Add unit, migration, updater, release-tool and real Electron UI tests.
- [x] Implement Windows/Linux packaging and guarded draft release workflows.
- [x] Verify Linux unpacked app and final AppImage with isolated profiles; retain packages and unpacked manual-test copy in Releases.
- [x] Publish migration branch to the public MIT repository and open PR #1; Windows/Linux CI passed at `8654609` (run `40432043548`).
- [x] Download both platforms' packages, retain unpacked manual-test copies, verify actual signed update assets, and fix the standalone verification CLI import cycle.
- [x] Owner explicitly requested merge and publication; PR #1 merged at `6a5c18a`.
- [x] Validate/sign all cross-platform assets in release CI, independently check the metadata signature and file coverage, then publicly publish v0.2.0-beta.2 as a prerelease.
- [ ] Record actual installed Windows/Linux N-to-N+1 upgrade evidence before promoting stable.

## 2026-10-26 Security And Private GitHub Publication

Status: Source fixes verified and published privately; system security updates await the user's sudo password

- [x] Review network, credentials, rendering, subprocess, storage, and publication boundaries.
- [x] Fix confirmed source issues and add security regression tests.
- [x] Inspect dependency advisories; system updates require the user's sudo password.
- [x] Complete final build, tests, and x64 packages.
- [x] Publish reviewed source to a private GitHub repository and verify visibility.

Repository: https://github.com/Leos-byte/MemoryGraph (private at that milestone; made public during the Electron migration at the user's request).
Initial source/security commit: `4494290`.

## 2026-08-27 Menu simplification

Status: Implemented and x64 release verified

- [x] Keep map rename, export, and delete actions only in the map context menu.
- [x] Keep Recycle Bin only in the File menu.
- [x] Consolidate right-panel node actions into More and remove duplicate controls.
- [x] Verify tests, responsive screenshots, and x64 release artifacts.

## 2026-08-27 Codex-aligned OpenAI models

Status: Implemented and x64 release verified

- [x] Compare MemGraph presets with the current Codex model selector.
- [x] Add missing OpenAI model options and use the exact Sol model ID.
- [x] Verify translations, tests, settings layout, and x64 release artifacts.

## 2026-08-27 Qt UI Refresh

Status: Implemented and x64 release verified

- [x] Install and apply the requested `qt-ui-design` skill.
- [x] Audit the existing Qt Widgets interface by severity.
- [x] Add semantic light/dark theme tokens and consistent widget styling.
- [x] Rework main-window information hierarchy and action grouping.
- [x] Improve graph readability, state feedback, fitting, and keyboard deletion.
- [x] Group Settings and improve Template Manager hierarchy.
- [x] Verify main, narrow, settings, and template layouts with offscreen screenshots.
- [x] Run final automated tests and generate x64 release artifacts.

## 2026-05-01 Rollback

Status: Completed

- [x] Stop the draw.io integration direction.
- [x] Archive the draw.io integration source, scripts, docs, and releases under `Backup/20260501-drawio-integration-archived`.
- [x] Restore the Qt/C++ implementation from `Backup/20260429-123143/source.tar.gz`.
- [x] Restore Qt/CMake development and release scripts.
- [x] Restore v0.1.0 release outputs as the active release line.
- [x] Record that draw.io integration is deprecated and should not be continued.

## v0.1.0

Status: Implemented and x64 build verified

- [x] Create project structure.
- [x] Implement Qt/C++ desktop application.
- [x] Implement local SQLite storage.
- [x] Implement graph-first UI.
- [x] Implement OpenAI-compatible API settings.
- [x] Implement custom full Prompt templates.
- [x] Implement Markdown node copy and whole-map export.
- [x] Add Chinese and English translation scaffolding.
- [x] Add Linux x64 and x86 build scripts.
- [x] Add portable and installer packaging scripts.
- [x] Add test scaffolding and manual test checklist.
- [x] Compile x64 Release build after installing C++/Qt/CMake dependencies.
- [x] Run automated tests for x64 Release build.
- [x] Add provider-aware model presets for OpenAI and DeepSeek.
- [x] Add API Key and official Codex CLI based ChatGPT authentication modes.
- [x] Add the latest DeepSeek V4 Flash model preset.
- [x] Keep an unpacked portable release directory for manual testing.
- [ ] Compile strict 32-bit x86 build in isolated Podman i386 environment. Status: paused by user request.

## Changed Decisions

- API Key persistence uses Linux Secret Service through `secret-tool` when available; otherwise it falls back to session-only storage. API keys are not written to SQLite, logs, Markdown exports, or backups.
- ChatGPT authentication is delegated to the official Codex CLI. MemGraph does not read or store ChatGPT credentials, and this authentication mode is limited to OpenAI models.

## Deprecated Decisions

- The draw.io/Electron integration route is deprecated by user request and must not be continued unless explicitly reopened later.
