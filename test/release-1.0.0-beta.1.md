# Major Release 1.0.0-beta.1 - 2026-10-29

## Authorization And Scope

Owner requested a major version, publication, and deletion of earlier version backups. Preparation uses v1.0.0-beta.1 rather than claiming stable/manual acceptance. Includes previously uncommitted Calico and manual/automatic updater features. No provider, dependency, public key, personal database or R2 configuration changes.

## Preflight

- Remote main fetched at `f02330d`; no upstream changes to merge.
- Typecheck/build passed; 129 units and 56 release-tool checks passed. Full versioned desktop run: all 17 passed (1.2 minutes). Versioned local unpacked smoke passed using a temporary profile.
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

Published [v1.0.0-beta.1](https://github.com/Leos-byte/MemoryGraph/releases/tag/v1.0.0-beta.1) at `2026-10-29T12:54:56Z` as a prerelease, not latest stable. PR #6 merged at `ff0635e1abf9ad5122ab2ad5f434846fe1b44a18`; source equals the tested feature commit `3d28ec544af69adbef5ebda9f447f218fb34ca44` for Source files. The immutable annotated tag targets that merge SHA.

- PR CI [40833451157](https://github.com/Leos-byte/MemoryGraph/actions/runs/40833451157): Linux and Windows passed; observed job durations 5m49s and 6m51s.
- Formal release [40875526528](https://github.com/Leos-byte/MemoryGraph/actions/runs/40875526528): validation, both platform builds/tests/smoke, signing and draft upload all succeeded. No failed-job rerun or bypass was needed in this task.
- Nine public assets: four Windows/Linux package formats, Windows installer blockmap, two beta updater YAML files and detached Ed25519 manifest/signature. Sign and upload jobs verified complete installer bytes, file sizes and SHA-512 hashes before upload.
- Independent local review downloaded the four small metadata files only, verified the unchanged bundled key's Ed25519 signature, manifest coverage/version/channel, updater hashes, GitHub metadata SHA-256 digests and all asset sizes/states. After publication, every asset ID/name/size/digest/state matched the reviewed draft. This is not a claim that all hosted installer bytes were downloaded locally.
- Downloaded metadata evidence: `Releases/v1.0.0-beta.1-github-metadata`, including before/after release JSON. R2 release/workflow-run jobs `40877257734` / `40876658311` were skipped; no mirror activated.

## Retained Backup And Cleanup Results

Exact tagged source: `Backup/20261029-v1.0.0-beta.1/source.tar.gz`, SHA-256 `dd14f554d65a4019970c20863401582c67e337a2560926a84701776786353b9b`.

Local compiled archive: `Backup/20261029-v1.0.0-beta.1/MemGraph-v1.0.0-beta.1-linux-x64-unpacked.tar.gz`, SHA-256 `6b678ccd1f3291c250589d7e29cb484a2b5b046d529c3f1087d960ea2143099a`. Both gzip archives passed integrity checks. This Fedora workstation build is not a byte-identical hosted download.

Unpacked manual-test app: `Releases/MemGraph-v1.0.0-beta.1-linux-x64-unpacked/memgraph`; executable mode is retained and its isolated versioned startup/SQLite/graph smoke passed. Source diff against tested feature/merge is empty.

After public verification, the cleanup guard confirmed seven actual direct-child Backup directories (no symlinks), valid nonempty new archives and protected key/database files. Deleted exactly the seven allowlisted historical directories above. Final inventory contains only `.gitkeep`, the new version directory, `update-signing-private.pem`, and `qt-v0.1.0-user-database.sqlite3`. Approximately 812 MiB of historical backups were removed. No old local Releases package, GitHub asset/tag or runtime database was deleted.

Earlier test/version records describe retention at those earlier dates; their removed Backup paths are historical evidence, not current recovery locations. Old source remains recoverable through retained Git tags. This cleanup is an explicit owner-directed action, not a new automated retention policy.

Remaining gates: actual Windows 10/11 NSIS installation, target FUSE/keyring behavior, installed N-to-N+1 replacement, real provider/account calls and end-user rollback. Actions reported a nonblocking Node 20 action-runtime deprecation advisory while running the pinned actions under Node 24; project runtime stayed Node 22/Electron 45 and no dependency/actions update was made during publication.
