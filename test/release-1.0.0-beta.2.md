# Snow Leopard Release - 2026-10-30

Owner request: continue until publication. New version 1.0.0-beta.2, retaining prior releases, backups, signing key and user data. No dependency updates, database migration or key rotation.

## Preparation

Implementation baseline: 141 units / 21 Electron scenarios / 56 release-tool tests plus typecheck/build and isolated Linux unpacked smoke, recorded in `test/snow-leopard-20261029.md`. The versioned release preflight and Windows/Linux hosted CI are required before merge. Real NSIS installation, Windows 10/11 desktop, AppImage/FUSE/keyring and installed N-to-N+1 replacement remain manual gates.

## Outcome

PR/CI, immutable tag/SHA, formal run, independent signed metadata verification, publication time and new backup/unpacked retention are pending observation. Do not overwrite earlier tags/assets or claim mocked tests establish actual installed upgrades.
