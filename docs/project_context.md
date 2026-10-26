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

## Product Rules

- Map rename/delete/export belong only in map context menus. Recycle bin belongs in File. Secondary node actions belong in More.
- Selection creates a linked child, generation off by default. Generating an existing concept reuses its node and edges.
- AI relation descriptions are appended to the source explanation, never used as edge labels.
- Chinese/English UI; template help follows the selected language.
- GitHub feedback opens the prefilled Issue page in a browser; email opens the default client addressed to leo.oceanai@gmail.com. No OAuth tokens, feedback server, or automatic data upload.
- Local Codex issue processing is user-directed; no unattended self-hosted runner or automatic merge.

## Release Rules

- Repository: Leos-byte/MemoryGraph, public with MIT license after publication review.
- Current target version 0.2.0-beta.1. Manual releases first create drafts; owner confirms publication.
- Windows installer/Linux AppImage auto-update; ZIP/tar users download a newer package. Stable and beta channels are separate.
- Signed manifests bind version/channel/file hashes. Private update key only in ignored Backup and GitHub SIGNING_PRIVATE_KEY secret; public key ships with app.
- First Windows builds are unsigned publishers; independent update signatures still required.
- npm run verify covers types, unit/backend and actual Electron UI flows. Release-tool tests: node --test DevScripts/tests/*.test.mjs.
- Do not claim Windows, clean-system, real provider or installed N-to-N+1 upgrade validation without recorded evidence. See docs/acceptance.md and docs/electron_release.md.
