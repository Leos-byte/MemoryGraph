# Problem Log

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
