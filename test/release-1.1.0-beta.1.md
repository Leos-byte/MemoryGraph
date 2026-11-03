# 1.1.0-beta.1 Release - 2026-11-03

Owner requested publication and GitHub sync. This release includes the rich-content workspace and desktop-menu redesign; it does not change the updater implementation.

## Verified Path

- Local: typecheck, build, 174 unit tests, 30 Electron desktop scenarios, 56 release-tool tests, isolated packaged Linux smoke, and runtime npm audit (0 vulnerabilities) passed. Full dev-tool audit still reports 15 moderate transitive advisories.
- PR [#8](https://github.com/Leos-byte/MemoryGraph/pull/8): first CI run `41412149238` failed on both platforms because one unit test depended on a pre-existing `dist-offline` build directory. The test now creates its own fixture. Final CI run [`41412528477`](https://github.com/Leos-byte/MemoryGraph/actions/runs/41412528477) passed Linux and Windows, including clean installs, tests, packaging and isolated smoke.
- Merge commit and annotated tag `v1.1.0-beta.1`: `102b5bd6a38d02afc0d6be924b342d539066b4f7`. Package and lockfile match the tag. Formal release run [`41596119535`](https://github.com/Leos-byte/MemoryGraph/actions/runs/41596119535) passed validation, both x64 builds, signing and draft upload.
- Independent draft check verified the Ed25519 manifest signature with the bundled public key, version/channel, seven asset entries, updater YAML SHA-512 values and remote SHA-256 digests for downloaded metadata. Main and tag still pointed to the same commit. Nine public asset IDs, sizes and digests exactly matched the reviewed draft.
- Public prerelease: https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.1.0-beta.1 ; published `2026-11-03T07:38:28Z`.

## Local Retention

- `Backup/20261103-v1.1.0-beta.1/source.tar.gz`: exact tagged source, SHA-256 `57bcf0aa8eeb15f33c3c9351661a1da29777a40942044c6aa396b1d6f8014ed1`.
- `Backup/20261103-v1.1.0-beta.1/MemGraph-v1.1.0-beta.1-linux-x64-unpacked.tar.gz`: local compiled copy, SHA-256 `b27c029aa38bdba5c5bf1a0038d4dde60a8663dcd62fd7730bd4a6d30327b331`. Both gzip streams passed integrity checks; this local build is not claimed byte-identical to GitHub's hosted build.
- `Releases/MemGraph-v1.1.0-beta.1-linux-x64-unpacked` and `Releases/v1.1.0-beta.1-github-metadata` retained for manual testing. Local Releases now keeps only this version, 1.0.0-beta.2 and 1.0.0-beta.1. Only the oldest local 0.2.0-beta.4 unpacked copy/metadata was removed; its GitHub release/tag and all Backups remain.

## Manual Gates

- Real Windows 10/11 interaction, NSIS install/uninstall, AppImage/FUSE and installed cross-version update/rollback were not performed. Portable ZIP/tar.gz still require manual replacement.
- Real xAI paid image generation, arbitrary external JSON services and OS credential backend behavior with personal accounts were not tested. No user database or secret was included in tests or release artifacts.
- Schema v2 cannot be opened by old beta.2. Keep the pre-upgrade snapshot, preserve a copy of the new database, and test rollback in a separate data directory. See `docs/rich_content.md`.
