# Local Releases Cleanup - 2026-10-30

Owner requested deleting unused files in `/home/leo/codexproject/MemoryGraph/Releases`, retaining only the latest three versions. This is a local artifact cleanup, not a source or GitHub release change.

## Retained

- `MemGraph-v1.0.0-beta.2-linux-x64-unpacked` and `v1.0.0-beta.2-github-metadata`.
- `MemGraph-v1.0.0-beta.1-linux-x64-unpacked` and `v1.0.0-beta.1-github-metadata`.
- `MemGraph-v0.2.0-beta.4-linux-x64-unpacked` and `v0.2.0-beta.4-github-metadata`.
- `.gitkeep`.

## Deleted Allowlist

Exactly 18 top-level entries, with no wildcard deletion:

```text
MemGraph-v0.1.0-linux-x64-portable.tar.gz
MemGraph-v0.1.0-linux-x64.run
MemGraph-v0.1.0-linux-x64-portable
MemGraph-v0.1.0-linux-x64-portable-unpacked
MemGraph-v0.2.0-beta.1-linux-x64-unpacked
MemGraph-0.2.0-beta.1-linux-x86_64.AppImage
MemGraph-0.2.0-beta.1-linux-x64.tar.gz
beta-linux.yml
0.2.0-beta.1-ci-40432043548
MemGraph-v0.2.0-beta.2-linux-x64-unpacked
MemGraph-0.2.0-beta.2-linux-x64.tar.gz
MemGraph-0.2.0-beta.2-linux-x86_64.AppImage
v0.2.0-beta.2-github-metadata
v0.2.0-beta.3-ci-40653746249
MemGraph-updates-dev-20261029-linux-x64-unpacked
MemGraph-calico-dev-20261029-linux-x64-unpacked
MemGraph-snow-leopard-dev-20261029-linux-x64-unpacked
snow-beta2-local-build
```

The unversioned `beta-linux.yml` referenced obsolete beta.2 packages. Its removal does not affect current per-version metadata. The snow-beta2-local-build directory held only builder debug output after the final app was moved to its retained versioned location.

## Verification

- Canonical target path matched the requested local Releases directory.
- Pre-deletion search found no SQLite/database, settings.json or api-key.enc files under Releases.
- Post-deletion inventory asserted exactly the seven retained entries; all three apps retain executable permissions and nonempty app.asar files. This was a filesystem check, not a new application startup test.
- SHA-256 before/after matches for retained app.asar files:

| Version | SHA-256 |
| --- | --- |
| 1.0.0-beta.2 | 216dd0bd81177f8d03cfa44668c3e32691958ee79365cbb0959c90d709ff8283 |
| 1.0.0-beta.1 | 6c1346453896fac9fae7ce9d4a7c1bd13c8e15fbadbca3500b7647ba74be1a2c |
| 0.2.0-beta.4 | b50792363f5fd2cb52f124c0bcaa410596d027af6daa5a45c41aa5d081d10afb |

`du -sb` changed from 5,667,958,957 to 1,092,540,738 bytes, a reduction of 4,575,418,219 bytes (about 4.26 GiB apparent size). Rounded filesystem usage changed from 5.3G to 1.1G; exact freed blocks may differ.

Backup, private signing key, independent database backup, production runtime data, source code and GitHub releases/tags were not deleted or modified. No rebuild is necessary for this artifact-only cleanup; previous test/release records remain historical evidence even when their older local artifact paths no longer exist.
