# Project Plan

## 2026-10-26 Security And Private GitHub Publication

Status: Source fixes verified and published privately; system security updates await the user's sudo password

- [x] Review network, credentials, rendering, subprocess, storage, and publication boundaries.
- [x] Fix confirmed source issues and add security regression tests.
- [x] Inspect dependency advisories; system updates require the user's sudo password.
- [x] Complete final build, tests, and x64 packages.
- [x] Publish reviewed source to a private GitHub repository and verify visibility.

Repository: https://github.com/Leos-byte/MemoryGraph (`private: true`).
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
