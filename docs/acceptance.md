# Electron Migration Acceptance

Target: **MemGraph 0.2.0-beta.3**, Windows x64 (NSIS + zip) and Linux x64 (AppImage + tar.gz). Public prerelease requested by the owner on 2026-10-28 and published at `08:52:39Z`. Unchecked manual gates below remain open before stable promotion. Use synthetic content and an isolated test data directory. Never test migrations/restores on the only copy of a user's data. A checked box requires observed evidence, not an implemented feature or a workflow file.

## Evidence Record

| Field | Record before approving release |
| --- | --- |
| Tag / full commit SHA | `v0.2.0-beta.3` / `3f6bfbd0a5da77b917d3a72c8e43cace18b2a4a1` |
| Tester / date | Automated agent validation, 2026-10-28 |
| Windows version / architecture | Windows Server 2022 x64 hosted runner; Windows 10/11 installation not run |
| Linux distribution / architecture | Linux x64 local; Ubuntu 22.04 x64 hosted CI |
| Windows CI run / artifacts | Passed: https://github.com/Leos-byte/MemoryGraph/actions/runs/40653746249; `release-packages-windows-x64`, `release-unpacked-windows-x64` |
| Ubuntu 22.04 CI run / artifacts | Passed: https://github.com/Leos-byte/MemoryGraph/actions/runs/40653746249; `release-packages-linux-x64`, `release-unpacked-linux-x64` |
| Real package smoke / upgrade evidence | Downloaded, hash-verified Linux unpacked beta.3 start/SQLite/graph/isolation checks passed using a temporary profile. Actual AppImage/FUSE, NSIS installation and installed N-to-N+1 replacement remain untested. |
| Known limitations / release notes | Windows publisher is unsigned; real provider/login, OS credential backend, NSIS installation and installed cross-version update checks remain manual release gates |

Both release jobs passed release-tool tests, unit tests, eight real Electron UI scenarios and isolated unpacked-application smoke, and built their two package formats. Local preflight passed 56 release-tool tests and 73 unit tests; Linux-only legacy/shell cases are skipped on Windows. These checks do not establish that NSIS installation, OS credentials, or an installed **N-to-N+1 upgrade** works. That upgrade has not been tested by this task. Record unavailable tests as **not run**, not passed. Do not attach private screenshots, graphs, tokens, databases, or raw provider logs as evidence.

Historical beta.1/beta.2 artifacts and backups remain untouched. Current beta.3 source/compiled backup is under `Backup/20261028-v0.2.0-beta.3`; its extracted Linux test build is under `Releases/v0.2.0-beta.3-ci-40653746249/linux-unpacked`. All seven package/updater assets were fully verified in release CI before upload. Metadata signatures, GitHub small-file digests, names and sizes were independently checked locally before publication; public asset identities/digests matched the reviewed draft. See `test/release-20261028.md`. The full installer bundle and Windows unpacked app were not mirrored locally.

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

- [x] The downloaded Linux beta.3 resources include the intended Ed25519 `update-public-key.pem`, compared as parsed SPKI. Windows packaged startup passed in CI; a separate downloaded-Windows key comparison was not repeated for beta.3.
- [ ] A missing signing secret does not break ordinary builds but blocks the signing/publish path. Missing public key and mismatched key pair also block publication.
- [x] `release-manifest.json` and `release-manifest.sig` verify against the bundled key, covering all four packages, both updater YAML files, and matching optional blockmaps (complete byte verification in release CI; independent local metadata signature/coverage verification before public publication).
- [ ] Modified manifest, invalid signature, missing coverage, altered package size/hash, duplicate asset, unexpected file, and wrong channel/version are rejected before upload/install.
- [ ] Installed NSIS/AppImage checks beta/stable channel correctly; no silent download/install, downgrade, or unverified update occurs. Portable zip/tar builds give a clear unsupported/manual update path.
- [ ] On a test prerelease, the previous installed version discovers/downloads/verifies the update; install/relaunch preserves data. Repeat rejection testing with controlled tampered metadata. A draft alone cannot prove this flow.
- [x] Release notes distinguish signed update metadata from OS code-signing. No Windows publisher trust is claimed without Authenticode evidence.

## Publication Approval

- [x] Repository visibility is public, MIT license is present, and maintainer contact is correct.
- [x] Manual dispatch was on `main`; tag, full SHA, package version, and lockfile versions matched. `main`/tag were not moved during the run and were rechecked before public publication.
- [ ] Configure/prove repository release-tag protection rules; this task did not change those rules.
- [x] Only the final publish job has `contents: write`; PR checks receive no secrets. Signing secret is scoped to signing, not building/publishing.
- [x] Workflow inferred beta from the validated version and created only a draft; all nine assets came from one successful run. Upload finished before the separate public-publish command. Published releases and moved refs are rejected by the tooling.
- [x] Owner explicitly requested PR merge and public publication. The prerelease notes disclose incomplete manual gates and unsigned Windows publishers. No auto-merge or issue-triggered execution was enabled. Full local mirroring was not claimed successful.
