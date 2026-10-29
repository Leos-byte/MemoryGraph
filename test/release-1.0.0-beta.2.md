# Snow Leopard Release - 2026-10-30

Owner request: continue until publication. New version 1.0.0-beta.2, retaining prior releases, backups, signing key and user data. No dependency updates, database migration or key rotation.

## Preparation

Implementation baseline is recorded in `test/snow-leopard-20261029.md`. Repeated versioned preflight passed: typecheck, production build, 141 units (9 files), 21 Electron scenarios and 56 release-tool tests. Desktop screenshots were inspected, including the Chinese narrow settings selector. The packaged beta.2 app passed isolated SQLite/graph startup smoke; its version and all five compiled JS/CSS/HTML resources match the final local build. No real model calls or personal credentials were used.

## Outcome

- Reviewed feature commit: `efab6863783bb96549fcf1d29b6c8544253bb0b2`.
- PR: https://github.com/Leos-byte/MemoryGraph/pull/7 ; merged `2026-10-29T17:54:02Z`.
- PR CI: https://github.com/Leos-byte/MemoryGraph/actions/runs/40924484539 ; Linux 6m19s, Windows 7m7s, both passed on first attempt.
- Immutable tag `v1.0.0-beta.2` / merge target: `161f877fe7762752974b7856d4e78310b34763cc`. Merge tree equals the reviewed feature tree.
- Formal run: https://github.com/Leos-byte/MemoryGraph/actions/runs/40925967111 ; validation, Linux build (6m17s), Windows build (7m7s), sign (35s), draft upload (45s) all passed on first attempt. Both platforms repeat tests, build, unpacked smoke and packaging. CI verifies full package bytes against the signed manifest before handoff/upload.
- Public prerelease: https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.0.0-beta.2 ; `isDraft=false`, `isPrerelease=true`, published `2026-10-29T18:05:44Z` / `2026-10-30 02:05:44 Asia/Shanghai`.
- Independent local verification downloads four small metadata files only, validates Ed25519 with the unchanged shipped public key, version/channel, signed coverage, SHA-512 updater hashes, GitHub SHA-256 metadata digests and uploaded sizes. Public asset IDs/names/sizes/digests/states exactly match the verified draft. Full hosted installers were not downloaded locally.

| Uploaded Asset | Bytes |
| --- | ---: |
| MemGraph-1.0.0-beta.2-windows-x64-setup.exe | 134370405 |
| MemGraph-1.0.0-beta.2-windows-x64.zip | 170347130 |
| MemGraph-1.0.0-beta.2-linux-x86_64.AppImage | 143956784 |
| MemGraph-1.0.0-beta.2-linux-x64.tar.gz | 136994970 |
| MemGraph-1.0.0-beta.2-windows-x64-setup.exe.blockmap | 142164 |
| beta.yml | 390 |
| beta-linux.yml | 415 |
| release-manifest.json | 1431 |
| release-manifest.sig | 89 |

## Retention

- `Backup/20261030-v1.0.0-beta.2/source.tar.gz`: exact tagged `git archive`, SHA-256 `16f468006a4f0826589ecf1ad65c990d2746b767df695c73de67baff6030ee44`.
- `Backup/20261030-v1.0.0-beta.2/MemGraph-v1.0.0-beta.2-linux-x64-unpacked.tar.gz`: workstation compiled archive, SHA-256 `7f41368f140e8c7148f1678c8abbf9394b3ca741d4f84af96a209b8b1093ab91`.
- Both gzip streams passed integrity checks; executable modes retained. This local compiled archive is not claimed byte-identical to hosted packages.
- `Releases/MemGraph-v1.0.0-beta.2-linux-x64-unpacked/memgraph`: retained manual-test app, reporting beta.2 (not the older beta.1-labeled development build).
- `Releases/v1.0.0-beta.2-github-metadata`: draft/public metadata snapshots and downloaded signed update files.
- Previous beta.1 backup, all historical GitHub releases/tags and local Releases preserved. No cleanup. Independent SQLite backup and signing key remain protected; neither is included in the source archive.

## Remaining Gates

Real NSIS installation, Windows 10/11 desktop, AppImage/FUSE/keyring, provider authorization and installed N-to-N+1 replacement/rollback remain manual gates. No Authenticode publisher signing; Ed25519 update signatures do not replace it. Native Tooltip/file dialogs/system-drawn select popups retain OS styling. Vite's existing bundle-size warning and SHA-pinned Actions' runtime deprecation notices remain non-blocking advisories.

R2 remains unconfigured/disabled; the formal workflow completion mirror run `40927343161` and public-release event run `40927546888` were both skipped. A mistaken initial status lookup of `mirror-r2.yml` returned 404; the actual workflow is `sync-r2.yml`, inspected without changing configuration. Do not claim mocked tests establish actual installed upgrades or overwrite earlier tags/assets.
