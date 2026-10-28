# Model Update / Release Evidence - 0.2.0-beta.4

Owner request: update OpenAI/DeepSeek models and publish. Baseline public version
is beta.3 at `3f6bfbd`; keep prior tags, assets and user data unchanged. The earlier
local documentation commit `334818a` was preserved and merged with PR #5.

## Implementation And Sources

- Official catalog check: `docs/models_20261028.md`; no inferred or invented model IDs.
- Add five GPT-6 choices and canonical `deepseek-flash`; retain Pro, old Flash
  alias and GPT-5/custom settings. Alias labels follow Chinese/English UI.
- New profiles use `gpt-6.1-terra`; existing settings files override that default
  unchanged. Explicit non-OpenAI to ChatGPT authentication uses the shared default.
- No endpoint/authentication relaxation, dependency update, account authorization,
  real key use or paid model request is introduced.

## Local Checks

- Typecheck and production build passed.
- 94 unit tests passed on Linux, including all 14 catalog payloads, signature
  policy, unchanged saved model IDs and bilingual alias labels.
- All 56 release-tool tests passed. Existing Windows-only/legacy skips remain
  platform-specific; counts are not claimed to be identical on every OS.
- All 10 real Electron scenarios passed after correcting native-select locators.
  The initial two locator failures are logged, not counted as successful runs.
- Final settings screenshots are checked at 1360x800 and 960x640. New model IDs
  and authentication controls must fit without transient notices obscuring them.
- Local Linux unpacked packaging and isolated startup/SQLite/graph/renderer
  smoke passed, reporting version `0.2.0-beta.4`. The rendered footer shows the
  fresh-profile model `gpt-6.1-terra`. Retained for manual tests at
  `Releases/MemGraph-v0.2.0-beta.4-linux-x64-unpacked`; this is a workstation build,
  not a byte-identical copy of separately generated/signed hosted artifacts.

## Publication Evidence

- [x] [PR #5](https://github.com/Leos-byte/MemoryGraph/pull/5) merged only after
  Windows/Linux CI `40683763704` passed. Attempt 1's Windows native-install failure
  was retried once without code/dependency changes; the complete retry succeeded.
- [x] Annotated `v0.2.0-beta.4` tag and release target point to
  `c99011580bbe46e80544c9131e417e3d4a619a58`. Source matches the tested feature build.
- [x] [Release run 40704949356](https://github.com/Leos-byte/MemoryGraph/actions/runs/40704949356)
  passed validate, both full builds, signing and draft upload on its first attempt.
- [x] Verify all signed asset bytes in CI, independently check draft metadata and
  unchanged published asset identities, then publish as a prerelease.
- [x] Retain exact tagged source and a compiled/unpacked backup; distinguish local
  workstation builds from the separately signed hosted release packages.
- [x] Record final PR/run/SHA/publication time and local test paths.

Public state confirmed: `isDraft=false`, `isPrerelease=true`, published at
`2026-10-28T14:32:24Z`, with all nine asset IDs, sizes, GitHub digests and upload
states matching the reviewed draft. Release:
https://github.com/Leos-byte/MemoryGraph/releases/tag/v0.2.0-beta.4 .

Local small-file checks verified the exact Ed25519-signed manifest bytes, base64
signature, version/channel, all required Windows/Linux package/updater names and
sizes, signed blockmap coverage, GitHub SHA-256 digests for both metadata and YAML
files, YAML SHA-512 hashes and package references. The complete cross-platform
installer hashes were independently checked by sign/upload jobs in CI, not by
downloading all installers locally.

## Retention

- `Releases/v0.2.0-beta.4-github-metadata`: downloaded metadata/YAML and before/after
  publication JSON records. These are not a full installer-bundle mirror.
- `Releases/MemGraph-v0.2.0-beta.4-linux-x64-unpacked`: locally built application;
  isolated startup/SQLite/graph smoke passed, parsed SPKI equals the bundled
  source public key and executable mode is preserved. Screenshots were inspected.
- `Backup/20261028-v0.2.0-beta.4/source.tar.gz`: exact tagged source, SHA-256
  `a1d31c02b781f2cf36e7ac7ebb1bb3aa6cd6cc31f6e7f207bf67187a4ddb5def`.
- Same backup directory contains the local compiled
  `MemGraph-0.2.0-beta.4-linux-x64-unpacked.tar.gz`, SHA-256
  `d05dd66f829f454b146bee456954dca7954bd79d4885ff92e305269584ef62e8`.

## Remaining Manual Gates

Real providers/login, NSIS installation, AppImage/FUSE, target keyrings and installed
N-to-N+1 updating remain manual checks. R2 configuration/upload remains deferred.
Observed R2 runs `40706505941` (release-workflow completion) and `40706936935`
(publication event) both completed as `skipped`; no mirror upload was activated.
