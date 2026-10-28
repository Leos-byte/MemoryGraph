# MemGraph 0.2.0-beta.3

Beta release for Windows and Linux x64.

## Changes

- Prevent an existing API key from being reused with a different provider when
  importing legacy Qt settings. Invalid imported endpoints/authentication modes
  are rejected before database replacement.
- Preserve Chinese and emoji when Codex stdout/stderr split a UTF-8 character
  across chunks. Terminal escape sequences continue to be removed.
- Add optional Cloudflare R2 mirroring of published, signature-verified release
  assets. It remains disabled and unconfigured; GitHub is still the update source.
- Add credential, encoding and mirror-workflow regression tests. Existing local
  knowledge maps, templates, SQLite data and Markdown workflows are retained.

## Downloads

- Windows x64: `MemGraph-0.2.0-beta.3-windows-x64-setup.exe` (installer) or
  `MemGraph-0.2.0-beta.3-windows-x64.zip` (portable).
- Linux x64: `MemGraph-0.2.0-beta.3-linux-x86_64.AppImage` or
  `MemGraph-0.2.0-beta.3-linux-x64.tar.gz` (portable).
- `release-manifest.json` and `release-manifest.sig` authenticate package/updater
  hashes with the existing Ed25519 update public key. Keep both metadata files.

## Beta Limitations

- Windows binaries do not have Authenticode signing; OS warnings may occur.
  Signed update metadata is not a trusted Windows publisher certificate.
- Back up user data before upgrading. Real NSIS installation, Windows 10/11,
  AppImage/FUSE, OS keyrings, real provider/login and installed N-to-N+1 update
  acceptance remain manual checks; automated/mock tests do not establish them.
- Portable ZIP/tar users replace packages manually. x86 remains unsupported.
- R2 bucket/domain setup and live upload verification are deferred; no mirror
  availability or regional download performance is promised by this release.

Report problems through the in-app GitHub feedback entry, or open a mail draft
to `leo.oceanai@gmail.com`. Do not include API keys or private knowledge data.
