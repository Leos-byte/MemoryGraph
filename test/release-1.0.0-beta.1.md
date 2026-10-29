# Major Release 1.0.0-beta.1 - 2026-10-29

## Authorization And Scope

Owner requested a major version, publication, and deletion of earlier version backups. Preparation uses v1.0.0-beta.1 rather than claiming stable/manual acceptance. Includes previously uncommitted Calico and manual/automatic updater features. No provider, dependency, public key, personal database or R2 configuration changes.

## Preflight

- Remote main fetched at `f02330d`; no upstream changes to merge.
- Typecheck and build passed. Unit baseline: 129 passed, release tools: 56 passed. Full versioned desktop run is being recorded before submission.
- Release must follow PR platform checks, exact main tag, hosted build/sign/draft upload and independent metadata review before publication. No historical tag/asset replacement.
- Windows installer/AppImage support in-app checks/download/restart; ZIP/tar use browser/manual replacement. Beta channel opt-in required. Real Windows installation, AppImage/FUSE and installed cross-version replacement remain unverified; see release notes.

## Backup Cleanup Allowlist

Delete only after successful publication and retaining the new source/compiled backup plus unpacked manual-test app:

1. `Backup/20261026-215903`
2. `Backup/qt-v0.1.0`
3. `Backup/20261027-v0.2.0-beta.2`
4. `Backup/20261028-v0.2.0-beta.3`
5. `Backup/20261028-v0.2.0-beta.4`
6. `Backup/20261029-updates-dev`
7. `Backup/20261029-calico-dev`

Inventory found approximately 812 MiB of historical program/source backups. The only SQLite file under Backup is the independent Qt backup below, outside this allowlist.

Preserve `Backup/update-signing-private.pem`, `Backup/qt-v0.1.0-user-database.sqlite3`, `.gitkeep`, the new `Backup/20261029-v1.0.0-beta.1`, all runtime data, all GitHub Releases/tags and all existing local Releases packages. No wildcard/routine automatic backup deletion is enabled.

## Outcome

Publication, run/SHA, independent verification, new retention paths and actual allowlisted deletion results are pending and must be recorded after observation, not assumed successful.
