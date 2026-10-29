# Problem Log

## 2026-10-29 - Skin Bootstrap Test Boundaries

- Initial desktop run: 19 passed, two new skin cases failed. A renderer fetch used to inspect bootstrap HTML was correctly blocked by existing `connect-src 'none'`; graph-style inspection ran before the SVG edge existed.
- Fix: inspect the same protocol response through main-process `net.fetch`, assert original CSP remains, and wait for visible graph paths/markers before reading computed style. No production security policy or graph behavior was relaxed.
- Focused rerun: three of four skin cases passed; the remaining bootstrap check compared lowercase hex to Electron's equivalent uppercase color. Normalize color case in the test rather than changing runtime behavior.
- Prevention: inspect pre-render resources from the appropriate trusted process, use readiness assertions for asynchronous SVGs, normalize equivalent native color representations. Attempts: initial full suite, focused rerun, then complete final rerun; total interactive time not instrumented. These were test-assumption issues, not evidence of failed persistence.

## 2026-10-29 - Calico Contrast And Existing Work

- Audit finding: apricot text on warm white is only about 2.02:1; supplied hover orange as a focus boundary is about 2.83:1. Secondary gray on beige is about 3.95:1. Replacing every old accent with orange would regress accessibility and conflate success with brand color.
- Resolution: split primary fills from readable accent/focus, add a stronger beige-surface text role and keep independent success/error/warning/info roles. Selected-node secondary text also uses the stronger role. Computed-browser regression tests check palette contrast, actual graph arrow fills and focus styling; color literals are centralized in tokens.
- Compatibility: preserve all prior updater edits and schema/security behavior. Reduced motion must cover React Flow camera calls as well as CSS; both now follow the OS preference.
- Attempts/time: initial 16-case suite and expanded 17-case suite passed; no test failure cycle. Two package builds retained the last hover refinement. Total interactive time was not instrumented. Existing Vite bundle-size and packaging duplicate-reference advisories were not treated as new functional failures.

## 2026-10-29 - Update Renderer Harness Window Selection

- Issue: both new simulated-updater UI cases initially sent their completion event to `BrowserWindow.getAllWindows().at(-1)`. Electron's window listing did not identify the intended new harness window; the main workspace is also open. The cases timed out looking for a ready/install control (35.1s and 33.1s). Production updater tests and the preceding 12 desktop flows passed.
- Fix/prevention: retain the new window's returned ID, target `BrowserWindow.fromId(id)` explicitly, and assert the harness snapshot's resulting status before interacting. Never infer ownership from native window enumeration order. No production IPC or updater bypass was added.
- Attempts/time: one failed focused run, one harness repair, then both focused cases passed in 3.8s; the final complete 14-case run also passed. Total interactive time was not instrumented.

## 2026-10-29 - Restricted Build And Subprocess Test Environment

- Issue: local unpacked packaging required an Electron runtime download and failed with sandbox `EAI_AGAIN github.com`. Separately, release-tool tests stalled after their first reported file inside the restricted process environment; exact child-process cause was not established.
- Handling: request explicit escalation for the required operations, without disabling TLS or modifying network/security settings. One approved packaging retry completed. Stop only the identified test process started by this task, then rerun release-tool tests under a 90-second timeout with approval; all 56 passed in 1.39s. The interrupted attempt is not counted as a pass.
- Prevention: for release-tool subprocess tests use an explicit timeout and the approved execution context; treat stalled/no-output runs as incomplete rather than relaxing security assertions. Use bounded, approved download retries and compare packaged bundles to the final compiled files before retention. Related earlier network/sandbox incidents remain below; no production/toolchain changes are justified by this environment-only result.
- Attempts/time: one failed restricted packaging attempt and one successful approved retry; one stopped restricted tool-test attempt and one successful bounded retry. Total interactive elapsed time was not instrumented.

## 2026-10-28 - Windows Native Install During Model PR CI

- Issue: PR CI `40683763704` attempt 1 failed before tests, while `node-gyp 12.4.0` compiled unchanged `better-sqlite3 13.0.3` under Node `22.23.4`/Python `3.15.1`. Reported `Completion callback never invoked`; the precise underlying cause was not proven. Linux passed.
- Handling: retry only failed jobs once, with the same commit/dependencies and no skipped install scripts or security checks. Windows then passed every test, smoke and package step; its successful attempt lasted 6m28s. Formal release `40704949356` subsequently passed both platforms and all signing/upload gates on the first attempt.
- Attempts/time: one failed Windows job (5m52s), one successful failed-job rerun, no dependency/configuration changes. Interactive waiting was not instrumented.
- Prevention: distinguish native-install failures from application/model test failures; retain the failed log and require full successful platform checks before merge. If the same failure persists after one bounded retry, inspect the runner toolchain/download logs and make a reviewed environment fix rather than repeatedly retrying, skipping native modules or publishing Linux-only results as cross-platform validation.

## 2026-10-28 - Native Select Regression Locators

- Issue: two new model-dialog cases failed to locate a nested native select using exact `getByLabel`, although the accessibility snapshot showed the correct combobox name and choices. This was not a missing model or successful API-call failure.
- Fix/prevention: use `getByRole('combobox', { name, exact: true })` for native selection controls in both languages; keep input-label locators for model text fields. Wait for transient Saved notices before screenshots. Give only the multi-save test a 90-second budget; other case limits remain unchanged.
- Attempts/time: one initial failed suite (2 cases, 51.1 seconds), one locator repair and successful full rerun (10 cases, 43.8 seconds). Total interactive elapsed time was not instrumented. No production UI labeling workaround or real model call was used to mask the test failure.

## 2026-10-28 - Release Network And Local Retention

- Issue: Git fetch/ls-remote and GitHub CLI queries repeatedly returned TLS EOF or connection resets. The cloud build continued successfully despite local polling failures. Root network cause was not established; disabling certificate checks or changing global DNS/proxy configuration was not attempted.
- Handling: stop dependent mutations after failed reads; use bounded read retries and reconcile live draft/published state before retrying publication. Track the existing workflow through the GitHub connector rather than dispatching duplicate builds. A one-command HTTP/1.1 Git trial did not resolve the outage; a later normal fetch succeeded.
- Download: the first Linux unpacked archive download timed out after 300 seconds at 83,525,632 bytes. A one-byte Range probe confirmed resumability (first probe hit a reset, second succeeded); one bounded 600-second remainder download completed. Combining both parts matched GitHub's full 141,879,248-byte ZIP SHA-256 before extraction. No incomplete archive was extracted.
- Process sandbox: Node's nested unzip invocation reported EPERM even with captured status/output. Continue using approved direct unzip/tar commands rather than interpreting that exception as a test pass. The final extracted app's isolated smoke then passed.
- Attempts/time: three initial Git fetch attempts (including HTTP/1.1) failed, followed by a successful continuation; subsequent read retries were capped at three per operation. Archive transfer limits were 300 and 600 seconds; total interactive wall time was not instrumented. Publication was retried only after checking it was still a draft; the confirmed successful publish was not repeated.
- Prevention: separate network/polling failures from cloud job failures, retain partial downloads, probe Range support, require complete byte length and transport hash before extracting, and distinguish CI full-package verification from local metadata/unpacked checks. Preserve exact tagged source/compiled backups without cleaning old Releases or user data.

## 2026-10-28 - R2 Draft CI And Activation

- Issue: PR #2 failed both hosted jobs because the workflow-policy test rejected its new `release` event (`40471754022`). Existing tests were correct for the original workflows but did not cover a narrowly constrained download mirror.
- Fix: allow the additional triggers only for `sync-r2.yml` and test their guards separately. Add tag/path, draft, missing-configuration, unsigned-download and upload-order regressions. Harden trusted main checkout, upstream workflow provenance, upload-only credential scope, signature/hash verification and serial writes.
- Deployment prerequisite: a names-only repository secret check found no R2 credentials. Automatic mirroring stays disabled until `R2_MIRROR_ENABLED=true`; bucket/domain setup and the first live upload remain external acceptance gates. No secret values were requested or read.
- Attempts/time: one diagnosis and implementation cycle; exact elapsed time was not measured. A failed test caused by intentionally added trigger behavior is distinct from earlier process-sandbox failures. Preserve the common policy tests and add explicit, narrow exceptions instead of removing security assertions.

## 2026-10-27 - PR Review Fix Execution

- Findings: Qt settings import overwrote the API origin without clearing an existing credential; per-chunk Buffer decoding corrupted split UTF-8 characters.
- Fix: common validate/apply settings helpers, import preflight before database replacement, and separate stdout/stderr UTF-8 stream decoders. Add regressions for old/new provider keys, invalid endpoints, Qt configuration parsing, and Chinese/emoji byte boundaries.
- Environment: local `.git` writes and GitHub CLI networking were unavailable. The connected GitHub API could read the repository, but tree creation was explicitly rejected because approval policy is never. No remote commit, branch, repair PR or merge was created, and local Git permissions were not changed.
- Validation: local unit tests use the supported threads pool. Desktop E2E launch failed with `sandbox_host_linux.cc` / EPERM; production/test sandbox settings were not weakened to work around the execution environment. Hosted CI is the GUI validation gate.
- Attempts: one implementation and local regression cycle; one blocked Git branch attempt, one blocked CLI query, successful connector reads, and one rejected connector tree-write request. Precise elapsed time was not recorded.
- Prevention: apply the same credential policy to every provider-changing entry point and exercise multibyte stream boundaries explicitly. Distinguish environment-blocked GUI runs from successful application tests.
- Follow-up (2026-10-28): after enabling approval requests, approved Git/network commands and Electron execution succeeded without weakening application sandbox settings. All 8 desktop scenarios passed. The signing-tool test also passed outside the restricted process sandbox (19 cases); its earlier restricted failure was environmental. The repeated approval failures are handled by checking the effective approval policy and requesting the necessary command permissions, not retrying identical writes or changing filesystem protection.

## 2026-10-27 - Local Release Artifact Mirroring

- Issue: the 585,784,363-byte signed Actions archive could not be downloaded completely to this machine. Multiple connections timed out after 20 seconds or transferred only partial chunks before their 120-second limit.
- Cause: insufficient/reliably unavailable local download connectivity; the hosted build, signature/hash verification, upload and release were successful. This was not an installer or signing failure.
- Attempts: one bounded 12-way segmented mirror attempt; then independent small-file metadata/signature downloads succeeded. The incomplete archive was not extracted or treated as valid.
- Resolution: publish the CI-verified prerelease after independently verifying the metadata signature/asset coverage. Retain the existing source-equivalent local Linux builds/unpacked copy and record that they are not byte-identical GitHub artifacts.
- Elapsed: no precise total was recorded; each large transfer was explicitly limited to 120 seconds.
- Prevention: keep public publication dependent on CI artifact verification and small signed-metadata checks, not a best-effort local full mirror. Use finite timeouts, transfer/digest validation, and explicit incomplete-mirror records; never label partial archives as packages.

## 2026-10-27 - Login Already Running

- User report: "Error invoking remote method 'memgraph:command': Error: Login is already running."
- Cause: the login IPC returned immediately after starting the child process, but Settings interpreted that acknowledgement as completion, re-enabled the login button and immediately queried status. The still-running backend rejected the next click. There was no cancel/resume UI, and cumulative process output was appended repeatedly.
- Fix: an application-owned LoginSession with idempotent start, revisioned progress, state recovery, cancellation, timeout, identity checks and process termination fallback. The UI follows actual session state and only automatically checks credentials after successful completion.
- Attempts: one implementation and local regression cycle; typecheck caught an additional global text-based login listener, which was updated to consume typed state. No real login was attempted.
- Result: 56 unit tests and seven Electron UI scenarios passed, including concurrent calls, Settings reopen, cancel/retry, timeout, stale completion, localization, and independent model-error notifications. Final package/hosted checks are recorded in the test evidence.
- Elapsed: precise wall-clock time was not recorded.
- Prevention: test IPC acknowledgement separately from asynchronous operation completion, and keep long-lived operation state outside transient dialogs.

## 2026-10-27 - Standalone Release Verification Import Cycle

- Issue: checking the downloaded, signed cross-platform packages through `release-artifacts.mjs check-signed` exited with code 13 and an unsettled top-level await.
- Cause: the CLI dynamically imported the verifier while the verifier statically imported the same CLI module. Existing in-process tests imported the modules in a different order and missed this entry-point cycle.
- Fix: move shared package validators to `release-package-files.mjs`, removing the cycle. Keep the CLI awaited and add a fresh-process regression covering both valid packages and same-size tampering.
- Attempts: confirmed the CLI failure; an entry-point-only change was insufficient, so the dependency cycle was removed. The local sandbox also blocked spawned test processes with EPERM; the complete tests were rerun with permission to execute child processes.
- Result: actual seven-asset release signature/hash validation passed; the standalone regression passed outside the restricted sandbox. Hosted regression validation follows in the migration PR.
- Elapsed: precise time was not recorded.
- Prevention: execute command entry points in subprocess tests, assert process errors as well as exit codes, and retain real cross-platform artifact validation before publication.

## 2026-10-27 - Windows Artifact Archiving

- Issue: the first Windows CI run passed 46/47 release-tool checks but failed while invoking tar on an absolute drive-letter archive path.
- Cause: Git Bash's GNU tar can interpret a colon in a Windows archive path as a remote-host separator.
- Fix: select Windows' System32/tar.exe explicitly and write a relative archive filename from the output directory; retain normal tar on Linux.
- Attempts: one hosted failure, one source correction, and local regression validation before rerunning CI. Both Windows and Linux then passed run `40432043548`, including archive collection. The existing archive test runs on both hosted platforms to prevent recurrence.
- Elapsed: precise time was not recorded.

## 2026-10-26 - Electron Migration Validation

- Native dependencies: Electron 45's npm package did not automatically install its binary. One explicit official install.js run resolved it; root postinstall now includes that downloader and electron-builder native dependency preparation.
- Rendering: Linux desktop/GPU screenshot attempts produced blank captures or stalled frame-stability checks. Two display configurations were tried; isolated Ozone headless tests with background throttling disabled in test mode produced working screenshots. Production retains the sandbox and ordinary display settings.
- Packaging: AppImage names use x86_64 while tar names use x64; staging accepts both. Electron-builder emitted latest metadata for the beta without an explicit channel, so the package wrapper now derives the channel from the package version.
- Elapsed: investigated during the migration; no precise per-attempt timing was recorded. The regression tests and wrappers preserve these fixes for future runs.

## 2026-10-26 - System Dependency Security Updates

- Issue: targeted OpenSSL, SQLite, and CA certificate security updates could not be installed automatically.
- Cause: sudo requires the user's interactive password. Fresh Fedora metadata also encountered a mirror TLS error; cached advisories were available.
- Attempts: one metadata refresh, one cached advisory check, and one non-interactive targeted upgrade. The upgrade stopped before changing packages.
- Resolution: source fixes and private publication completed; the exact manual upgrade command and advisory IDs are recorded in `security_audit.md`.
- Timing: observed across the security audit; precise elapsed time was not recorded.

This file records non-trivial problems encountered while completing plans, tests, and tasks.

## Entry Format

- Date:
- Task:
- Problem:
- Cause:
- Attempts:
- Time spent:
- Result:
- Prevention:

## 2026-04-28

- Date: 2026-04-28
- Task: Initial environment inspection.
- Problem: The local Fedora environment has no `g++`, `cmake`, `ninja`, `qmake`, or `qtpaths` on PATH.
- Cause: Development dependencies are not installed in the current environment.
- Attempts: Checked compiler, build tools, Qt tools, distribution, and package manager.
- Time spent: Less than 10 minutes.
- Result: Project implementation must include environment setup scripts and cannot assume Qt is installed.
- Prevention: `DevScripts/setup_env.sh` detects Fedora/dnf and prints the required install command.

- Date: 2026-04-28
- Task: Build verification.
- Problem: `DevScripts/build.sh --arch x64 --type Release --package none` cannot run because `cmake` is missing.
- Cause: The environment has no compiler, build system, or Qt development tools.
- Attempts: Checked `cmake`, `ninja`, `g++`, `clang++`, `c++`, `make`, `qmake6`, and `lrelease`; all required build tools are unavailable.
- Time spent: Less than 10 minutes.
- Result: Script syntax and source-level checks were completed, but actual compilation is blocked until dependencies are installed.
- Prevention: Run `DevScripts/setup_env.sh --install` on Fedora, then rerun `DevScripts/build.sh --arch x64 --type Release --package none`.

- Date: 2026-04-28
- Task: Strict 32-bit x86 build.
- Problem: `DevScripts/build.sh --arch x86 --type Release --package portable` failed during CMake compiler detection.
- Cause: The host lacks 32-bit i686 runtime and development libraries. The linker could not find `crt1.o`, `crti.o`, 32-bit `libstdc++`, `libm`, and `libgcc_s`.
- Attempts: Tried to install `glibc-devel.i686 libstdc++-devel.i686 qt6-qtbase-devel.i686 sqlite-devel.i686`, but `sudo` requires an interactive password that is unavailable in the current session.
- Time spent: Less than 10 minutes.
- Result: x64 builds and tests pass; x86 remains blocked until i686 dependencies are installed manually.
- Prevention: Run `sudo dnf install -y glibc-devel.i686 libstdc++-devel.i686 qt6-qtbase-devel.i686 sqlite-devel.i686`, then rerun the x86 build.

- Date: 2026-04-28
- Task: Recheck strict 32-bit x86 dependency state.
- Problem: x86 build still fails after the dependency issue was reported as resolved.
- Cause: `rpm -q glibc-devel.i686 libstdc++-devel.i686 qt6-qtbase-devel.i686 sqlite-devel.i686 libgcc.i686 glibc.i686` reports that all listed i686 packages are not installed in the current environment.
- Attempts: Reran x86 build and inspected GCC `-m32` search paths and expected runtime object files.
- Time spent: Less than 10 minutes.
- Result: The x86 compiler test still cannot find `crt1.o`, `crti.o`, 32-bit `libstdc++`, `libm`, or `libgcc_s`.
- Prevention: Install the i686 packages in this exact environment, then verify with `rpm -q glibc-devel.i686 libstdc++-devel.i686 qt6-qtbase-devel.i686 sqlite-devel.i686 libgcc.i686 glibc.i686`.

- Date: 2026-04-28
- Task: Fedora i686 Qt dependency install.
- Problem: Installing `qt6-qtbase-devel.i686` fails because it conflicts with `qt6-qtbase-devel.x86_64` on `/usr/bin/qt-configure-module`.
- Cause: Fedora 43 Qt6 devel packages are not installable side-by-side for this host multilib scenario.
- Attempts: Confirmed the package transaction conflict and adjusted the project workflow.
- Time spent: Less than 10 minutes.
- Result: Strict x86 builds should use `DevScripts/build_x86_podman.sh`, which installs i686 Qt devel packages inside an isolated Fedora container instead of the host.
- Prevention: Do not install `qt6-qtbase-devel.i686` on the same host root as `qt6-qtbase-devel.x86_64`; use Podman, mock, or a dedicated i686 build root.

- Date: 2026-04-28
- Task: Podman i386 Fedora image test.
- Problem: `registry.fedoraproject.org/fedora:43` has no image for architecture `386`.
- Cause: Fedora 43 does not publish a 386 image in that manifest list.
- Attempts: Tried `podman run --arch i386 registry.fedoraproject.org/fedora:43`.
- Time spent: Less than 10 minutes.
- Result: `DevScripts/build_x86_podman.sh` now defaults to `docker.io/i386/debian:trixie` and supports Debian/Ubuntu dependency installation in addition to Fedora.
- Prevention: Use the Debian i386 container default unless a known 386 Fedora-compatible image is provided through `--image`.

- Date: 2026-04-28
- Task: Podman x86 build cache reuse.
- Problem: The x86 Podman build saw an existing host-created `Source/build/x86-Release/CMakeCache.txt` and failed because the cached source path was `/home/leo/codexproject/MemoryGraph/Source`, while the container source path is `/workspace/Source`.
- Cause: Host and container builds reused the same build directory name.
- Attempts: Stopped x86 work after user requested that x86 be paused.
- Time spent: Less than 10 minutes.
- Result: `DevScripts/build.sh` now supports `MEMGRAPH_BUILD_DIR_SUFFIX`, and `DevScripts/build_x86_podman.sh` uses `x86-Release-podman` to avoid host/container cache collisions.
- Prevention: Keep host and container build directories separate.

- Date: 2026-04-28
- Task: New map creation.
- Problem: Creating a new map failed with `NOT NULL constraint failed: maps.description Unable to fetch row`.
- Cause: `query.addBindValue(QString())` binds a null string value in the SQLite driver, not an empty text value, so it violated `maps.description TEXT NOT NULL`.
- Attempts: Replaced the map description bind value with `QStringLiteral("")` and added a GraphStore test that creates a map and verifies the description is an empty string.
- Time spent: Less than 10 minutes.
- Result: x64 build passes and `MemGraphCoreTests` passes.
- Prevention: Use explicit `QStringLiteral("")` for NOT NULL text defaults instead of default-constructed `QString()`.

## 2026-05-01

- Date: 2026-05-01
- Task: Roll back draw.io integration.
- Problem: The active source tree had been migrated to draw.io/Electron, but the user decided not to continue that integration direction.
- Cause: Product direction changed after manual inspection of the draw.io-based build.
- Attempts: Archived the current draw.io integration state under `Backup/20260501-drawio-integration-archived`, then restored `Source`, `DevScripts`, `docs`, `test`, `readme.md`, and `Releases` from `Backup/20260429-123143/source.tar.gz`.
- Time spent: Less than 20 minutes.
- Result: Active development is back on the Qt/C++ v0.1.0 line. The draw.io route is marked deprecated in project docs.
- Prevention: Before future architecture rewrites, keep the existing implementation as active until the user confirms the replacement is acceptable after manual UI testing.

## 2026-08-26

- Date: 2026-08-26
- Task: ChatGPT login terminal output rendering.
- Problem: The login window displayed strings such as `ESC[90m` as garbled control-symbol text around the Codex welcome message.
- Cause: `codex login --device-auth` emits ANSI terminal color sequences, and the login dialog inserted merged process output directly into `QTextEdit` without terminal interpretation or sanitization.
- Attempts: The first attempt inspected generated Markdown and normalized model output, but it did not affect the separate login-process output path. The user's exact sample exposed the remaining ANSI sequence.
- Time spent: Less than 20 minutes across two attempts.
- Result: Added a shared terminal-text sanitizer used by both login and generation paths, disabled CLI colors through environment variables, and made the login dialog sanitize accumulated output so ANSI sequences split across read chunks are also handled.
- Prevention: Route all future external CLI text through `TextSanitizer` and keep both complete and chunked ANSI sequences in automated tests.
