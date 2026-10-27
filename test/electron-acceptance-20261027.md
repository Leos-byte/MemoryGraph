# Electron Package Evidence - 2026-10-27

Version: 0.2.0-beta.1. Artifact source: migration commit `865460991f1b2212940d89c3654d32e3469eb12a`, [CI run 40432043548](https://github.com/Leos-byte/MemoryGraph/actions/runs/40432043548). Both Windows Server 2022 x64 and Ubuntu 22.04 x64 passed. A documentation-only follow-up also passed run `40434059502`.

## Automated Evidence

- Each platform passed dependency installation, typecheck, 45 unit tests, five Electron end-to-end scenarios, packaged startup, and installation/portable package builds.
- Original hosted release-tool suite: 47 tests. A standalone `check-signed` process regression was subsequently added (48 total), including detection of same-size package tampering.
- Three downloaded artifact ZIPs passed complete ZIP CRC checks before extraction. No private data or credentials were used in the packaged startup checks.
- All four packages, two updater YAML files and the Windows installer blockmap were signed locally, then verified with `release-artifacts.mjs check-signed`. The application public key matches both unpacked builds; Windows PEM line endings differ but parsed keys are identical.
- Downloaded Linux unpacked and AppImage packages both passed actual isolated SQLite/graph/renderer smoke checks on Fedora 44. The unpacked app correctly reports automatic installation unsupported; AppImage reports supported. AppImage used extract-and-run, not FUSE.

## Local Manual Test Copies

Root: `Releases/0.2.0-beta.1-ci-40432043548` (ignored by Git).

- `packages/`: NSIS installer, Windows ZIP, Linux AppImage/tar.gz, updater metadata, detached signature and manifest.
- `linux-unpacked/memgraph`: executable Linux application, ready to launch.
- `win-unpacked/MemGraph.exe`: executable Windows application, ready to copy to Windows and launch.

Linux, from the repository root:

```bash
./Releases/0.2.0-beta.1-ci-40432043548/linux-unpacked/memgraph
node DevScripts/release-artifacts.mjs check-signed --source Releases/0.2.0-beta.1-ci-40432043548/packages --version 0.2.0-beta.1
```

Ordinary interactive launching keeps the application sandbox enabled. The automated headless smoke harness uses test launch flags and temporary profiles, not real user databases. Do not share actual data directories or private keys in feedback.

## Still Required

Owner PR review/merge and draft-release approval; ordinary-user Windows 10/11 NSIS installation/uninstallation; real installed N-to-N+1 updates with data preservation/recovery; target-system FUSE and keyring checks; optional explicitly approved live model/device-login checks. Windows beta has no publisher code signature. Local manifest signatures do not imply Windows publisher trust. No public Electron Release or automatic merge was performed.
