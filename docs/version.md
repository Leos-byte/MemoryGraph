# Version History

## 0.2.0-beta.2 - 2026-10-27 - Login Session Recovery

- Fix the login button becoming available while Codex still waits for device authorization. Repeated requests now reuse the current login instead of throwing "Login is already running."
- Keep application-owned login progress across Settings close/reopen; use revisioned events to reject stale IPC responses.
- Add cancel/retry and ten-minute timeout recovery, and terminate a child process that ignores cancellation.
- Replace cumulative login output instead of appending duplicated copies; show localized progress/completion/failure states.
- Add seven login-session tests, four process-lifecycle tests, and one real Electron login UI scenario using a fake CLI without real authorization or model calls.

## 0.2.0-beta.1 - Electron Migration

- Replace Qt UI with Electron + React + TypeScript and React Flow, preserving graph learning behavior and existing SQLite data.
- Freeze Qt at qt-v0.1.0-frozen with local source/release/database backups.
- Add safe legacy import, owner-only storage, bounded model requests, cancellation and restricted preload APIs.
- Add browser-based GitHub Issue feedback and default-client email feedback without account or backend requirements.
- Add Windows/Linux x64 CI, NSIS/ZIP and AppImage/tar builds, signed update manifests, separate stable/beta channels and manual draft releases.
- Add backend, migration, updater, release-tool and Electron end-to-end regression tests.

## 2026-10-26 - Security hardening

- Require HTTPS API endpoints, block redirects, clear keys when changing API origins, and redact keys from API errors.
- Block Markdown resource loading and unsafe URL schemes.
- Restrict Codex tools and add response limits, timeouts, and cancellation.
- Cancel old generation tasks when switching databases and ignore stale results.
- Restrict database permissions and prevent recursive template variable substitution.
- Add security regression tests and publication/backup exclusions for sensitive data.
- Document system dependency security updates still requiring sudo in `security_audit.md`.

## 2026-08-27 - Menu simplification

- Moved Rename Map, Export Map Markdown, and Delete Map exclusively to the selected map's context menu.
- Kept Recycle Bin exclusively in the File menu.
- Consolidated all secondary node actions into the More menu in the Markdown panel and removed duplicate action buttons.

## 2026-08-27 - Codex-aligned OpenAI model presets

- Expanded the OpenAI and ChatGPT model selector to match the models currently visible in Codex.
- Added `gpt-5.5` and `gpt-5.4` presets and changed the Sol preset to the exact `gpt-5.6-sol` model ID.
- Kept legacy `gpt-5.6` settings recognizable and retained custom model IDs and DeepSeek presets.

## 2026-08-27 UI Refresh

- Applied the `qt-ui-design` audit workflow to the Qt Widgets interface.
- Added a shared Fusion-based visual system with semantic light/dark colors, a 12 pt desktop type scale, visible keyboard focus, and consistent controls.
- Reworked the three-panel workspace to prioritize the map canvas and explanation flow while moving lower-frequency node actions into a More menu.
- Added action availability states, keyboard shortcuts, status-bar feedback, and readable map-management controls.
- Added a graph grid, localized node statuses, semantic status indicators, hover/selection feedback, zoom limits, automatic graph fitting, and Delete-key support.
- Grouped Settings into model/authentication, learning preferences, and data storage sections.
- Reworked Template Manager hierarchy, Prompt typography, help affordance, and primary/danger actions.
- Added `docs/ui_audit.md` with critical, warning, and opportunity findings.

## 2026-05-01 Rollback

- Stopped the draw.io/Electron integration direction by user request.
- Archived the draw.io integration state at `Backup/20260501-drawio-integration-archived`.
- Restored active `Source` to the Qt/C++ implementation from `Backup/20260429-123143/source.tar.gz`.
- Restored Qt/CMake `DevScripts`, project docs, test notes, and v0.1.0 release outputs.
- Active development returns to the v0.1.0 Qt/C++ line.
- Optimized the top menu: Settings, Template Manager, and About now open directly from the menu bar.
- Reduced duplicate map management actions in the File menu; Rename/Delete remain in the map list controls and context menu.
- About now displays the application version and version update/build time.
- Optimized Template Manager with New, Copy, Save, and soft-delete actions.
- Deleted templates now move to Recycle Bin and can be restored before the bin is emptied.
- Template saving now validates required fields: name, system prompt, user prompt, and the `{{concept}}` variable in the user prompt.
- Template help now documents required fields and required/recommended variables for knowledge-map generation.
- Optimized graph canvas interactions: right-click blank canvas to create a node at that position, choose whether to generate immediately, right-drag the canvas to pan, and right-click a selected node to delete it.
- Added current OpenAI GPT-5.6 model presets: Sol (`gpt-5.6`), Terra (`gpt-5.6-terra`), and Luna (`gpt-5.6-luna`), all using the Responses API.
- New installations now default to GPT-5.6 Terra; existing saved model settings are preserved.
- Optimized model settings with provider-aware presets and authentication selection.
- Added ChatGPT account login through the official Codex CLI device-auth flow; MemGraph does not read or store ChatGPT credentials.
- Added the latest DeepSeek V4 Flash (`deepseek-v4-flash`) preset while retaining DeepSeek V4 Pro.
- Normalized ChatGPT/Codex Markdown output to remove terminal control sequences and unstable emoji glyphs, and convert Unicode arrows to ASCII for consistent Qt rendering.
- Fixed the ChatGPT login window displaying Codex ANSI color codes as garbled text, including control sequences split across process-output chunks.

## v0.1.0

- Initialize project structure.
- Add Qt/C++ desktop application source.
- Add local SQLite graph storage.
- Add graph canvas, map list, node editor, and Markdown preview.
- Add OpenAI-compatible API configuration.
- Add custom full-prompt templates.
- Add single-node Markdown copy and whole-map Markdown export.
- Add Linux build and packaging scripts.
- Add Fedora environment setup script.
- Add backup script.
- Add Qt Test scaffold for Prompt template rendering.
- Build verified for Linux x64 Release.
- Generated Linux x64 portable and installer release packages.
- Portable release builds now also keep an unpacked copy in `Releases` for manual testing.
- Fixed new map creation failing because an empty description was bound as SQLite NULL.
- Added a DeepSeek V4 Pro model preset using `https://api.deepseek.com` and `deepseek-v4-pro`.
- Added node deletion.
- Added deleted-node recovery to avoid accidental deletion.
- Added manual node-to-node connection creation.
- Added manual node content editing.
- Added data directory display and configurable data directory setting.
- Added in-app template help.
- Added version information to Settings.
- Improved Settings layout with a scrollable, wider form.
- Removed the duplicate top toolbar actions and kept core actions in menus or task panels.
- Data directory changes now reopen the selected database immediately and reload maps without restarting.
- Added map renaming from the map list panel and map context menu.
- Linked-node creation from selected text now defaults to creating a node without generation, with a Settings option to enable automatic generation.
- Added relation description updates for existing node connections.
- Relation descriptions are written to the end of the source concept explanation instead of being shown on graph edges.
- Fixed Update Relation so it can create a missing relation between two active nodes instead of only editing existing edges.
- Update Relation now calls the configured API model to generate the relationship description from both node explanations.
- Added Recycle Bin for deleted maps and nodes, with restore and empty-trash actions.
- Reorganized the top menu into File, Settings, Template Manager, and About.
- Removed database file and version information from Settings.
- Renamed the data directory setting to database directory and kept immediate database reload after changing it.
