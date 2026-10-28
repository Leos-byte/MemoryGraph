# PR Review Repair Evidence

Scope: API-key isolation during Qt settings import, and UTF-8 decoding of Codex login/process output. No real keys, account authorization or model requests are used.

## Local Checks

- Typecheck and production build passed.
- All 48 release-tooling tests passed in an approved run on 2026-10-28.
- Unit suite passed with `npm run test -- --pool=threads`: 73 tests on Linux (the Qt INI parser case is skipped on Windows because that legacy format is Linux-only).
- Settings cases cover clearing memory and stored credentials before switching providers, same-origin preservation, explicit replacement/clear, unsafe URL/authentication rejection before side effects, and directory-switch failure.
- The Qt parsing case reads only temporary XDG configuration/data directories. UTF-8 cases split Chinese/emoji into individual bytes on both streams and interleave incomplete stdout/stderr characters.
- The initial restricted run could not launch Electron (`sandbox_host_linux.cc` / EPERM) and was not marked passed. On 2026-10-28 an approved run passed all 8 desktop scenarios, including the new provider-switch/no-key generation case, without changing test or production sandbox settings. Windows/Linux hosted CI remains required before merge.

## Merge And Publication

Initial attempts were blocked by read-only `.git` access and the disabled approval policy. On 2026-10-28 approved Git/network commands succeeded, remote main was confirmed at `f4ca2a7062a196ed45e42a69918d175b454cc91d`, and the repair branch `fix/provider-key-and-codex-utf8` was submitted as [PR #3](https://github.com/Leos-byte/MemoryGraph/pull/3). Both Windows/Linux Electron CI jobs must pass before merging; the linked PR is the authoritative record of their results and the merge outcome. Cloudflare R2 draft PR #2 is unrelated and remains untouched. No version tag, package or public Release is replaced by this task.

An earlier complete patch was checked against a temporary archive of the original HEAD before handoff. The repair branch and repository files are the current source of truth; the earlier temporary patch predates these progress updates.
