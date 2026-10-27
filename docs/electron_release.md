# Electron Release

Release baseline: **0.2.0-beta.1**, public MIT repository `Leos-byte/MemoryGraph`, Electron + React + TypeScript, Windows and Linux **x64 only**. The publish job refuses a private repository. Nothing in these workflows merges pull requests or makes a draft release public.

## Local Setup

Install Node.js **22 x64**, including npm. Run commands from the repository root. The wrappers resolve their own location and always run npm inside `Source`. `Source/package-lock.json` must be committed and match `Source/package.json`; setup uses `npm ci`, not an unpinned install. Do not add `--ignore-scripts`: the runtime postinstall explicitly runs `node node_modules/electron/install.js` before `electron-builder install-app-deps` to install Electron's binary. Installation may need build tools for native SQLite modules when no prebuilt binary is available.

Linux:

```bash
bash DevScripts/setup_electron.sh --check
bash DevScripts/setup_electron.sh
bash DevScripts/verify_electron.sh
bash DevScripts/build_electron.sh
```

On Ubuntu 22.04, install the desktop libraries before testing or launching:

```bash
sudo apt-get update
sudo apt-get install -y xvfb libgtk-3-0 libnss3 libasound2 libgbm1 libatk-bridge2.0-0 libsecret-1-0 libfuse2
```

On Fedora, install the corresponding distribution packages (for example `gtk3`, `nss`, `alsa-lib`, `mesa-libgbm`, `libsecret`, `xorg-x11-server-Xvfb`, and `fuse-libs`). Package availability varies by Fedora release. Use `gcc-c++`, `make`, and Python 3 if a native dependency must compile. Do not disable the Electron sandbox to work around a desktop configuration problem. For AppImage use, FUSE availability and executable permissions must be checked on the actual target system.

Windows PowerShell:

```powershell
.\DevScripts\setup_electron.ps1 --check
.\DevScripts\setup_electron.ps1
.\DevScripts\verify_electron.ps1
.\DevScripts\build_electron.ps1
```

Use an interactive x64 Windows desktop session for local E2E testing. If compilation is required, install Python 3 and Visual Studio Build Tools with C++ support. If local PowerShell policy blocks these scripts, review them and use the equivalent `node DevScripts/electron-cli.mjs setup|verify|build` commands; no machine-wide policy change is required.

Build options on either platform: `--build-only` runs only `npm run build`; `--unpacked` builds and runs `npm run package:dir -- --publish never`. The default builds the host's packages with `npm run package -- --publish never`. These options do not install dependencies or run tests automatically. Verify before packaging. `verify` delegates to `npm run verify`; on headless Linux it wraps that command in `xvfb-run -a`. No real provider credentials are needed for the automated fixture tests.

For development, run `npm run dev` inside `Source`; it builds and launches Electron, not a Vite web server. The main entry is `dist-main/main.cjs`. Build output is disposable; user databases are not.

## Outputs

The runtime owner maintains `Source/electron-builder.yml`. All new packages go to **`Source/dist-release`**, never the local `Releases` directory:

| Platform | Required artifacts |
| --- | --- |
| Windows x64 | `MemGraph-0.2.0-beta.1-windows-x64-setup.exe`, `MemGraph-0.2.0-beta.1-windows-x64.zip`, `beta.yml` |
| Linux x64 | `MemGraph-0.2.0-beta.1-linux-x86_64.AppImage`, `MemGraph-0.2.0-beta.1-linux-x64.tar.gz`, `beta-linux.yml` |

Matching `.blockmap` files, when generated, travel with those packages. `win-unpacked` and `linux-unpacked` are archived separately for testing, preserving file modes. Builder debug files, private keys, user data, and unpacked directories are not GitHub release assets.

AppImage maps electron-builder's `${arch}` to `x86_64`; this is the same x64 target, not another architecture. The collector accepts `x86_64` or `x64` for AppImage only; other formats must use `x64`.

For stable `X.Y.Z` versions, filenames use that version and updater metadata is `latest.yml` / `latest-linux.yml`. The validated package/tag version alone determines the signing/release channel: `X.Y.Z-beta.N` maps to `beta`; `X.Y.Z` maps to `stable`. Other prerelease names/build suffixes are rejected. The main-owned builder config must produce the corresponding channel metadata; do not assume that a GitHub provider infers `beta` just from a prerelease version. Use builder `publish.channel: beta` for beta or `publish.channel: latest` for stable when explicit configuration is needed, and verify the generated filenames before tagging. The signer's stable channel name remains `stable`, not `latest`.

`build.sh` and `setup_env.sh` are compatibility wrappers for the Electron scripts. The old `build_x86_podman.sh` belongs to the paused Qt x86 work and is not an Electron entry point. Frozen Qt source is under `Backup/qt-v0.1.0/source`, with the frozen tag preserved; the earlier source/scripts snapshot is `Backup/20261026-215903/source.tar.gz`. Do not restore either over the active migration. `Backup`, its ignored signing key, existing `Releases`, and existing user databases must never be cleaned by release tooling. Electron does not support the old x86 target.

## Pull Request Checks

`.github/workflows/electron-ci.yml` runs on pull requests and pushes to `main`, using GitHub-hosted `windows-2022` and `ubuntu-22.04` runners. Both install with `npm ci`, test release tooling, typecheck, unit-test, build, E2E-test, and build both unpacked and packaged apps. Linux E2E uses Xvfb. No repository secrets are referenced and no publisher runs in this workflow. Token permissions are read-only, checkout credentials are not persisted, and actions are pinned to commit SHAs.

Successful jobs upload `ci-packages-{platform}-x64` and `ci-unpacked-{platform}-x64` (7 days). Failed tests may upload synthetic `Source/test-results` diagnostics (3 days). Never execute the suite against private user data: those diagnostics are visible to people with access to Actions artifacts. PR artifacts are untrusted test builds, not signed releases. Extract the unpacked tar archive before launching it.

## Signing Setup

1. Keep the Ed25519 **public** key in `Source/update-public-key.pem`, bundled by electron-builder `extraResources`. Inspect the actual packaged app to confirm the same key is in its resources.
2. Store the matching PEM **private** key in the repository Actions secret **`SIGNING_PRIVATE_KEY`**. A local ignored `Backup/update-signing-private.pem` is not uploaded or read by Actions automatically. Never commit, print, attach, or put it in artifacts. Back up that key securely outside the repository workspace.
3. A missing secret, missing/invalid public key, mismatched pair, or invalid signature must block publication. Normal CI, local builds, and release package-build jobs do not require the signing secret.

The runtime-owned command for the initial beta is:

```bash
# Run inside Source, with SIGNING_PRIVATE_KEY securely supplied in the environment.
npm run release:sign -- --dir dist-release --version 0.2.0-beta.1 --channel beta
```

The workflow infers and passes `--channel stable` for a stable version such as `0.2.0`; this is not a free-form dispatch input that can disagree with the tag/package.

For local signing only, the runtime also supports `--private-key ../Backup/update-signing-private.pem`; use it only when deliberately signing a complete, reviewed cross-platform release directory. Do not paste the key value into a shell command. This infrastructure never reads the real local private key in tests; it generates temporary test pairs instead.

The signer writes `release-manifest.json` (`version`, `channel`, and `files` containing `name`, `size`, `sha512`) and `release-manifest.sig` (base64 detached Ed25519 signature over the exact JSON bytes). The release verifier independently checks that signature against the bundled public key, all sizes/hashes, all four packages, both updater YAML files, optional matching blockmaps, and absence of extra files. Preserve raw JSON bytes when verifying. This is update authenticity, **not Windows Authenticode signing**; unsigned beta installers may trigger OS warnings. Never claim a trusted Windows publisher without a separate certificate/signing process.

Changing the bundled public key breaks verification for clients that trust only the old key. Plan key rotation and compromised-key recovery before changing it; do not casually regenerate it for every release.

## Manual Release

1. Complete [acceptance.md](acceptance.md), review the diff, and manually merge the tested change. Confirm public visibility, the MIT license, the bundled key, the signing secret, and the feedback email. Require the two platform checks through branch protection if available. Protect `v*` tags from movement/deletion through repository rules.
2. Ensure the version in `Source/package.json`, `Source/package-lock.json`, and the lockfile root package agrees (`0.2.0-beta.1` for the initial beta). Use a new version for each subsequent beta/stable release, matching builder metadata to its inferred channel. Commit these changes before tagging.
3. Fetch and inspect `origin/main`; create and push an existing tag at its **current HEAD**. For example, after the intended commit is on `main`:

```bash
git fetch origin main --tags
git tag -a v0.2.0-beta.1 origin/main -m "MemGraph 0.2.0-beta.1"
git push origin refs/tags/v0.2.0-beta.1
gh workflow run electron-release.yml --ref main -f tag=v0.2.0-beta.1
```

4. Dispatch **on `main`**, not on the tag. Validation requires the canonical repository, manual event, matching full SHA, existing lightweight/annotated tag at `main` HEAD, and matching package/lock versions. There are no tag-push, issue, comment, `pull_request_target`, `workflow_run`, or self-hosted-runner publishing triggers.
5. The build matrix checks out that exact SHA and repeats verification/build/packaging with `--publish never`. It uploads per-platform package and unpacked artifacts. The read-only `sign` job downloads only this run's packages, assembles them without overwrites, installs locked dependencies, and runs the signing command with the secret scoped to that step.
6. Only `publish` has `contents: write`. It receives `signed-electron-release`, installs no npm dependencies, rechecks signatures/hashes and remote `main`/tag SHAs, and uses `gh release create --verify-tag --draft` followed by `gh release upload`. Beta versions additionally set `--prerelease`; stable versions do not. It never executes downloaded packages. It refuses a published release and rechecks the draft's channel/tag/SHA immediately before replacing assets.
7. Review the draft's complete asset list, version, platform results, signed metadata, and release notes. Download and test the actual packages. Manually publish the reviewed release in GitHub. Draft releases are not visible to normal update clients, so end-to-end updater discovery requires a published test release in the appropriate channel and a previous installed version.

Do not move `main` or the tag, or publish the draft, during a release run. Ref/draft checks are repeated immediately before upload operations, but cannot atomically prevent a later remote state change. Tag protection and maintainer coordination remain necessary. A failed upload may leave an incomplete **draft**, never an automatically public release. Fix a transient failure and rerun while the same tag is still current `main`; otherwise create a new version/tag. Do not move a published tag or overwrite a public asset to repair a release.

## Feedback And Limits

The application opens the user's browser with `https://github.com/Leos-byte/MemoryGraph/issues/new?template=bug.yml` and URL-encoded report text in `environment`. The bilingual form keeps version, OS, steps, expected/actual behavior, and privacy confirmation explicit. Evidence and email are optional; private logs are never mandatory. Mail contact is **leo.oceanai@gmail.com**, matching the runtime. Review all prefilled content before sending; the application must not submit issues or mail silently.

Local validation was performed on Fedora; hosted Windows Server 2022 and Ubuntu 22.04 tests and packaging both passed in [run 40432043548](https://github.com/Leos-byte/MemoryGraph/actions/runs/40432043548). The final local Linux AppImage also passed an isolated extract-and-run smoke test. These checks cover signature policy, synthetic update scenarios and actual application startup, not an installed N-to-N+1 upgrade. That upgrade, real NSIS installation, Windows 10/11 compatibility, AppImage/FUSE, OS keyrings and live providers remain manual release gates. See [acceptance.md](acceptance.md) for explicit evidence recording.

References: [GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub release CLI](https://cli.github.com/manual/gh_release_create), [artifact permission preservation](https://github.com/actions/upload-artifact#permission-loss).
