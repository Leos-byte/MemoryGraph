# Model Update / Release Evidence - 0.2.0-beta.4

Owner request: update OpenAI/DeepSeek models and publish. Baseline public version
is beta.3 at `3f6bfbd`; keep prior tags, assets and user data unchanged. The earlier
local documentation commit `334818a` is retained in this feature branch.

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

## Publication Gates

- [ ] Push/merge a dedicated feature PR only after Windows/Linux CI passes.
- [ ] Tag current tested main as `v0.2.0-beta.4`; run the existing manual release workflow.
- [ ] Verify all signed asset bytes in CI, independently check draft metadata and
  unchanged published asset identities, then publish as a prerelease.
- [ ] Retain exact tagged source and a compiled/unpacked backup; distinguish local
  workstation builds from the separately signed hosted release packages.
- [ ] Record final PR/run/SHA/publication time and local test paths.

No beta.4 tag, draft or public publication is claimed at this preparation checkpoint.
Real providers/login, NSIS installation, AppImage/FUSE, target keyrings and installed
N-to-N+1 updating remain manual checks. R2 configuration/upload remains deferred.
