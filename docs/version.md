# Version History

## 1.0.0-beta.1 - 2026-10-29

- Major Calico release combines the unified light design, responsive reading/templates and accessible state/focus improvements with manual/automatic signed updates.
- Keep SQLite/settings compatibility and existing models; no dependency or signing-key changes. Windows/Linux x64 installer and portable formats remain supported, with in-app replacement limited to NSIS/AppImage.
- Published https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.0.0-beta.1 at `2026-10-29T12:54:56Z`. PR #6 / tag: `ff0635e1abf9ad5122ab2ad5f434846fe1b44a18`; PR CI `40833451157` and release build/sign/upload `40875526528` passed both platforms. All nine asset identities/digests remained unchanged after independent draft review/publication.
- Retained exact tagged source, local compiled backup and unpacked manual-test app. Deleted the seven explicitly inventoried historical Backup program/source directories, preserving the signing key, independent Qt database backup, runtime data and GitHub history. See `test/release-1.0.0-beta.1.md`; real installed upgrades remain a manual gate.

## Pre-Release Implementation Record - 2026-10-29

The following describes the implementation stage before publication in 1.0.0-beta.1 above.

- Replace the previous green renderer theme with light Calico tokens, warm-white/cream surfaces, apricot actions and readable charcoal typography. Preserve semantic status colors, existing workflows and uncommitted updater behavior.
- Unify graph arrows/edges, Markdown/code/tables, shared controls/dialogs, compact typography and responsive template management. Add computed-color and narrow-layout regressions; no dependencies or public version change.
- Add manual, automatic check-only (default), and opt-in automatic check/download policies. Background checks start after 15 seconds and repeat every six hours on supported installed builds.
- Show progress/readiness in the header; retain verified downloaded state across dialog reopening. Require explicit restart confirmation and a successful SQLite backup before installation, including auto-download mode.
- Add settings/manual update entry points and GitHub fallback for unpacked/development builds and update errors. Localize new controls and statuses in Chinese/English.
- Block duplicate operations and stale channel results, keep downgrade disabled after the updater's channel setter, and permit recovery after asynchronous installer errors. Add settings migration, signed updater and renderer-control tests.
- No dependency, public version, tag, GitHub assets, R2 configuration or private credentials changed. beta.4 remains the latest public release.

## 0.2.0-beta.4 - 2026-10-28

- Add the five current GPT-6 family presets and canonical `deepseek-flash`; keep Pro and a localized old Flash compatibility alias.
- Share preset/default metadata. Fresh profiles use GPT-6.1 Terra; saved/custom IDs are not migrated and provider key isolation is unchanged.
- Add exact request payload, persistence, localization and desktop selection tests. No dependency updates or paid API calls. See `docs/models_20261028.md` and `test/models-release-20261028.md` for sources and observed verification.
- Published prerelease: https://github.com/Leos-byte/MemoryGraph/releases/tag/v0.2.0-beta.4 at `2026-10-28T14:32:24Z`. PR #5 merged/tagged at `c99011580bbe46e80544c9131e417e3d4a619a58`; CI `40683763704` passed after retrying the failed Windows native install, and formal release run `40704949356` passed both platforms, signing and upload on its first attempt.
- Independently verified draft signature, asset coverage, small-file digests and updater hashes; all nine published asset identities/digests remained unchanged. A local Linux unpacked test build and source/compiled backups are retained. Prior versions are unchanged; R2 remains off and real provider/account calls were not tested.

## 0.2.0-beta.3 - 2026-10-28

- Includes merged PR #3: isolate API credentials when importing provider settings and preserve split UTF-8 Chinese/emoji in Codex output.
- Includes merged PR #2: optional signed-asset R2 mirror with restricted triggers, upload-scoped credentials and regression coverage. R2 remains unconfigured and automatic uploads are off.
- Published prerelease: https://github.com/Leos-byte/MemoryGraph/releases/tag/v0.2.0-beta.3 . Tag points to `3f6bfbd0a5da77b917d3a72c8e43cace18b2a4a1`; release run `40653746249` passed both platforms, signing and upload. Nine files were published unchanged at `2026-10-28T08:52:39Z`.
- Package and lockfile versions match, without dependency changes. Independently verified signed metadata and the downloaded Linux unpacked artifact; its isolated startup/SQLite/graph smoke passed. See `test/release-20261028.md` for local paths and untested manual gates.

## 0.2.0-beta.3 - Optional R2 Download Mirror Details

- Add opt-in mirroring of published GitHub Release assets to Cloudflare R2, plus manual historical backfills. GitHub remains the updater source.
- Restrict trusted triggers/checkout, verify existing signatures and hashes before upload, scope credentials to upload and copy the manifest last.
- Add mirror workflow regressions and setup/recovery instructions. Actual R2 upload and domain verification require external configuration and are not claimed by mocked tests.

## 0.2.0-beta.3 - PR Review Fix Details

- Share endpoint/authentication validation and origin-bound key clearing between Settings and Qt configuration import. Validate imported settings before replacing the database; clear memory and persisted credentials before saving a different provider.
- Decode Codex stdout/stderr as independent UTF-8 streams, preserving Chinese and emoji split across byte chunks.
- Add settings/legacy-configuration and UTF-8 boundary regressions. These changes do not replace the already published v0.2.0-beta.2 packages.

## 0.2.0-beta.2 - 2026-10-27 - Login Session Recovery

- First public Electron prerelease: https://github.com/Leos-byte/MemoryGraph/releases/tag/v0.2.0-beta.2 . PR #1 merged; tag points to `6a5c18a3ba5b343cada9100f11fa2dbf9e2e908e`. Windows/Linux release run `40453434325` passed.
- Fix the login button becoming available while Codex still waits for device authorization. Repeated requests now reuse the current login instead of throwing "Login is already running."
- Keep application-owned login progress across Settings close/reopen; use revisioned events to reject stale IPC responses.
- Add cancel/retry and ten-minute timeout recovery, and terminate a child process that ignores cancellation.
- Replace cumulative login output instead of appending duplicated copies; show localized progress/completion/failure states.
- Separate model-generation errors from login events so relationship failures retain their error notifications without changing authentication state.
- Add seven login-session tests, four process-lifecycle tests, and two real Electron regressions for fake-CLI login and mocked relation errors without real authorization or model calls.

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
