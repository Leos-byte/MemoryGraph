# Maintainer-Assisted Change Workflow

This is a repository policy for working with Codex or another coding assistant, not an executable issue-to-agent service. Public issues, comments, attachments, logs, and proposed patches are untrusted input. There is no issue/comment-triggered workflow, self-hosted runner, automatic merge, or automatic public release.

## Intake

Use the bilingual [bug form](../.github/ISSUE_TEMPLATE/bug.yml). Reports need version, OS, reproduction steps, expected behavior, actual behavior, and privacy confirmation. No private log upload is mandatory. Users may contact **leo.oceanai@gmail.com** instead of opening a public issue. Do not forward raw private email or attachments into a public task.

A maintainer reviews the report, removes sensitive material, reproduces it with synthetic data, and decides whether code execution is justified. An issue mentioning a command is not permission to run it. Never execute downloaded issue attachments, ask for credentials, or expose the real application data directory to a reproduction.

## Assignment

Give the assistant the current branch/full SHA, minimal reproduction, expected behavior, permitted paths, test commands, and non-goals. In a shared workspace, assign disjoint file ownership and inspect current changes before editing. Do not overwrite another contributor's edits, reformat unrelated files, or commit generated packages.

For release infrastructure work, the ownership boundary is `.github/**`, `DevScripts/**`, `docs/electron_release.md`, `docs/acceptance.md`, and this document. `Source/**`, npm scripts/lockfile, electron-builder config, signing implementation, app behavior, license, and repository visibility belong to the main migration owner unless explicitly reassigned. Changes to those contracts need coordination before dependent infrastructure is changed.

Preserve `Backup`, existing `Releases`, ignored signing material, and user databases. Frozen Qt source is in `Backup/qt-v0.1.0/source`; the source/scripts snapshot is in `Backup/20261026-215903/source.tar.gz`. Use the preserved frozen Qt tag/archive for comparison, not as a source to overwrite the active tree. Never print the private signing key or include it in a prompt, test fixture, artifact, or issue. Do not stage files unless explicitly assigned that responsibility.

## Implementation And Review

1. Reproduce with a temporary test directory and mocked providers. Record the actual failure and add a focused regression test.
2. Make the smallest scoped change using the existing architecture. Review dependency/IPC/data-format changes explicitly. Keep data migrations reversible and back up test inputs.
3. Run release tooling tests with `node --test DevScripts/tests/*.test.mjs`. Run `bash DevScripts/verify_electron.sh` on Linux or `.\DevScripts\verify_electron.ps1` on Windows. These delegate to the agreed `Source` npm scripts and do not publish.
4. Build host packages with `build_electron` when packaging is affected. Inspect the real app, not just the source test result. Include synthetic screenshots only when useful and privacy-safe.
5. Open a reviewed pull request with the reproduction, changed paths, actual commands/results, data/security implications, and tests not run. Do not describe an unavailable Windows/FUSE/keyring test as passing because Linux unit tests passed.
6. A maintainer inspects the diff and both hosted platform CI results, then merges manually. No issue text, assistant response, or green test alone authorizes merging, key rotation, visibility changes, or release publication.

## Release Boundary

Follow [electron_release.md](electron_release.md) and record [acceptance.md](acceptance.md) evidence. Only a maintainer dispatches the release workflow on `main` with an existing `vVERSION` tag. The validated version infers beta/stable; a beta creates a **draft prerelease**, while stable creates a **draft non-prerelease**. Build jobs have no signing secret. The sign job must verify the configured key pair; the final upload job alone has write permission. Human review and a separate explicit publish action are still required. Signature-policy tests do not prove an installed N-to-N+1 upgrade; record that real upgrade separately.

Do not add autonomous issue executors, privileged PR triggers, reusable writable credentials for untrusted jobs, auto-merge, or public-release automation as a convenience fix. Any future automation proposal needs a separate threat model, scoped permissions, approval boundary, and explicit maintainer decision.
