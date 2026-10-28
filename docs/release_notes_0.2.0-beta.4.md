# MemGraph 0.2.0-beta.4

Beta release for Windows/Linux x64, updating model choices verified on 2026-10-28.

## Changes

- Add OpenAI presets `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`
  and `gpt-6-luna`.
- Add DeepSeek's canonical `deepseek-flash` preset. Keep `deepseek-v4-pro` and
  label `deepseek-v4-flash` as a compatibility alias in Chinese and English.
- Use GPT-6.1 Terra for new profiles. Existing model settings, custom IDs, maps,
  templates, SQLite data and API keys are preserved; changing service origin
  still clears the old provider's key.
- Share catalog/default metadata between Settings and profile creation. Add
  exact-payload, saved-settings and desktop model-selection regressions.

See the [dated model/source check](https://github.com/Leos-byte/MemoryGraph/blob/main/docs/models_20261028.md)
for official model documentation and compatibility details.

## Downloads And Limits

- Windows x64: NSIS installer or portable ZIP; Linux x64: AppImage or tar.gz.
- Package/updater files are authenticated by the existing Ed25519 signed manifest.
  Windows binaries are not Authenticode signed and may show OS warnings.
- Presets do not grant model access. ChatGPT login requires a current official
  Codex CLI and supported account/workspace; API keys and provider charges remain
  separate. No real provider/account authorization was used in automated tests.
- Back up data before upgrading. Installed N-to-N+1 updating, NSIS installation,
  target OS keyrings/FUSE and real-provider acceptance remain manual beta checks.
- Portable builds require manual replacement. x86 remains paused. R2 stays
  unconfigured and disabled; no mirror availability is promised.
