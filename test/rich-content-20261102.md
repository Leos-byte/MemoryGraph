# Rich Content Verification - 2026-11-02

## Scope

- Local uncommitted implementation on the existing menu/retention worktree; public version remains 1.0.0-beta.2. No commit, push, tag, release, updater change or Releases/Backup cleanup.
- Host: Linux x64, Node22, Electron45. Tests use temporary user directories/databases and fake transport/AI. Personal data/credentials and real paid providers were not used.
- New modules and boundaries: `docs/rich_content.md`.

## Observed Checks

- `npm run typecheck`: passed after final source changes.
- `npm test`: 174/174 across 11 files passed. Includes declarative schema/type/size/depth rejection, Markdown AST preservation, state/filter/aggregate/chart construction, image validation/deduplication/sharing/recycle/bin backups, successful v1 migration, transactional migration failure, incompatible v2 rejection, source authorization/cache/revocation/in-flight replacement, explicit paid-image confirmation/concurrency, stale action previews, and offline ZIP contents without credentials.
- `timeout 90s node --test DevScripts/tests/*.test.mjs`: 56/56 passed; no network publishing.
- `npm run build`: passed, producing main/preload, lazy renderer chunks and a self-contained `dist-offline` viewer. Vite reports chunks above 500 kB (editor/chart/diagram dependencies); warning remains visible rather than suppressed.
- `npm audit --omit=dev`: zero known runtime vulnerabilities. Full `npm audit`: 15 moderate build-chain reports through minimatch/electron-builder. No forced incompatible builder downgrade. A clean audit is not proof of absence of defects.
- Initial complete `npm run test:e2e`: 30/30 passed, including original 25 flows plus five rich-content scenarios. Final repeat after diagram contrast/source invalidation is recorded below.
- Independent package: `npm run package:dir -- --linux --x64 --publish never --config.directories.output=dist-release/rich-preview-20261102`. Initial package and extended smoke passed; final repack verification is recorded below.

## UI Coverage

- Both Calico/Snow skins, Chinese/English, desktop and 390px narrow layout. No horizontal document overflow in the new reading scenario.
- Formula, strict diagram SVG/text, text contrast and containment inside node shapes, canvas chart pixels, linked input/filter/count/table and saved state across reload.
- Source/visual editing retains opaque content; local image import survives saving; script HTML, remote tracking images and invalid component types do not execute/load and do not hide following prose.
- Map actions do not mutate until preview plus confirmation; cancel leaves map unchanged, confirmed child has a parent edge.
- Actual contextual export command opens a format chooser; offline HTML loaded with `file:` in a sandboxed BrowserWindow has no preload bridge, no automatic HTTP requests, working local filter/chart and disabled map writes.
- Image/source settings use ordinary Save and discard protection; returned profiles never contain the submitted API key.
- Packaged smoke additionally opens the visual editor, verifies local SQLite/native module/connection workflows and a nonblank chart, and checks offline viewer/asset entries inside the exported ZIP.

## Evidence And Limits

- Generated screenshots/reports live in ignored `Source/test-results/` and `Source/playwright-report/`. Full-suite runs reset test-results; execute package smoke afterward to retain its screenshots.
- Preview executable: `Source/dist-release/rich-preview-20261102/linux-unpacked/memgraph`. It still displays beta.2 because this task did not bump or publish a version. Use an independent `--user-data-dir` for manual acceptance before migrating personal data.
- Known open gates: Windows build/real-OS dialogs/clipboard/IME, actual xAI authorization/fees/timeout behavior, live third-party API variability, and unusual Tiptap Markdown syntax. No installed N-to-N+1 update claim; updater unchanged.
- Old beta.2 cannot read schema2. Keep a database copy and pre-upgrade snapshot; rollback path is documented, never overwrite a new database with an old program.

## Final Repeat

- Final typecheck/build and 174 unit tests passed. Final complete Electron suite: **30/30 passed in 1.7 minutes**, with actual export-menu interaction and SVG text/contrast/containment checks. No production edits followed this final run.
- Final isolated Linux package and extended smoke passed: native SQLite, linked nodes, formula/SVG labels, nonblank chart pixels, interactive filtering, visual editor and ZIP viewer/assets. Screenshot review confirms natural-sized centered diagram labels and no label/frame overflow in the covered fixtures; desktop/narrow skin screenshots were inspected.
- Final app.asar SHA-256: `22092f92f6f6faa5ca6ae0220ec8b2a23c8857c7bb696cad8162c1db26562e47`.
- `git diff --check` passed. `Releases` still contains only unpacked apps/metadata for v1.0.0-beta.2, v1.0.0-beta.1 and v0.2.0-beta.4 (plus `.gitkeep`). Existing user changes were preserved.
- Remaining engineering follow-ups: production renderer chunks remain large; the unpacked preview is approximately 614 MiB including Electron and production dependencies. Builder emits duplicate-reference diagnostics. Runtime audit is clean, while the fifteen moderate development-tool advisories and the manual Windows/xAI gates above remain open. No claim of universal Markdown/diagram/provider compatibility.
