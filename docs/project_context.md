# Project Context

MemGraph helps users understand, connect, remember, and transfer knowledge through local concept graphs and Markdown explanations.

## Active Architecture

- Electron 45, React 19, TypeScript; npm packages pinned by Source/package-lock.json.
- Source/main owns SQLite, credentials, model requests, files, feedback URLs, and updates. Source/renderer is sandboxed React/React Flow; Source/shared/types.ts defines the restricted preload bridge.
- Preserve legacy SQLite schema, string-encoded IDs, parent links, default/custom templates, recycle-bin state, and generation history.
- Qt v0.1.0 frozen at git tag qt-v0.1.0-frozen; source/release archives and SQLite snapshot are local under Backup. Do not reintroduce draw.io integration.
- Windows x64 NSIS+ZIP, Linux x64 AppImage+tar.gz. x86 remains paused.
- SQLite and settings remain local. API keys use secure OS storage, memory-only if unavailable; never return keys to renderer or store in SQLite.
- ChatGPT authentication belongs to installed official Codex CLI. MemGraph must not read or copy Codex credentials. Windows CLI launch avoids shell string concatenation.
- LoginSession owns a revisioned in-memory login state; start is idempotent while running. Settings restores that state, exposes cancellation and follows completion/timeout events instead of treating the launch IPC return as login completion. Fake CLI UI tests never authorize a real account.

## Product Rules

- Map rename/delete/export belong only in map context menus. Recycle bin belongs in File. Secondary node actions belong in More.
- Selection creates a linked child, generation off by default. Generating an existing concept reuses its node and edges.
- AI relation descriptions are appended to the source explanation, never used as edge labels.
- Chinese/English UI; template help follows the selected language.
- GitHub feedback opens the prefilled Issue page in a browser; email opens the default client addressed to leo.oceanai@gmail.com. No OAuth tokens, feedback server, or automatic data upload.
- Local Codex issue processing is user-directed; no unattended self-hosted runner or automatic merge.

## Release Rules

- Repository: Leos-byte/MemoryGraph, public with MIT license. Active branch is main.
- Released 0.2.0-beta.2 as a public prerelease on 2026-10-27 at the user's explicit request: https://github.com/Leos-byte/MemoryGraph/releases/tag/v0.2.0-beta.2 . Future releases still start as drafts and require owner approval.
- PR #1 merged at `6a5c18a3ba5b343cada9100f11fa2dbf9e2e908e`, tagged `v0.2.0-beta.2`. Release run `40453434325` passed both platforms, signing and draft upload (56 unit tests, seven UI scenarios, 48 release-tool tests). The agent then independently verified signed metadata/asset coverage and made the release public. Actual installed N-to-N+1 updating remains untested.
- GitHub has all nine release assets. The full Actions artifact mirror to this machine timed out; existing local beta.2 Linux packages/unpacked copy remain available but are not byte-identical GitHub build artifacts. See test/release-20261027.md.
- Windows installer/Linux AppImage auto-update; ZIP/tar users download a newer package. Stable and beta channels are separate.
- Signed manifests bind version/channel/file hashes. Private update key only in ignored Backup and GitHub SIGNING_PRIVATE_KEY secret; public key ships with app.
- First Windows builds are unsigned publishers; independent update signatures still required.
- npm run verify covers types, unit/backend and actual Electron UI flows. Release-tool tests: node --test DevScripts/tests/*.test.mjs.
- PR #3 merged at `d92180e` after Windows/Linux CI `40629772669` passed: shared origin-bound key clearing for settings/Qt imports and independent Codex UTF-8 stream decoders. Local verification: 73 unit tests, 8 desktop scenarios, 48 release-tool tests before R2 additions.
- Owner subsequently requested processing R2 PR #2. Optional mirror uses published GitHub assets only, verifies their existing signatures/hashes before upload, and never executes them. Automatic upload requires `R2_MIRROR_ENABLED=true`; real R2/domain acceptance remains separate from mocked tests. See `docs/r2_mirror.md` and PR #2 for current CI/merge status. Do not request secret values in chat or change the updater away from GitHub as part of this task.
- Do not claim Windows, clean-system, real provider or installed N-to-N+1 upgrade validation without recorded evidence. See docs/acceptance.md and docs/electron_release.md.
