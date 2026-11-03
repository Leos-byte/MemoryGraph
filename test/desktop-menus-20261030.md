# Desktop Menu Verification - 2026-10-30

## Scope

Owner requested Aero / Windows 7 desktop-style menu layout and structure. Existing React/custom CSS/shared Menu reused; no new dependencies, native menus, database migration or updater changes. Preserve both skin palettes and the previous three-version local Releases retention. Public beta.2 files are not changed.

Modified implementation: `Source/renderer/App.tsx`, `ui.tsx`, `styles.css`, `i18n.ts`. Test changes: `Source/tests-electron/e2e/workspace.spec.ts`. Navigation becomes File / Settings / Templates / Help. Settings/Templates open directly, File owns maps/data/recycle bin, Help owns updates/feedback/About. Map commands remain contextual; node commands are grouped and destructive actions retain confirmation.

## Checks

- Typecheck and production build passed. Existing Vite >500kB chunk advisory remains.
- 141 unit tests across nine files passed; 56 release-tool tests passed with a 90-second bound.
- Four new focused desktop menu scenarios passed: command ownership/order and direct settings; keyboard/type search/focus/pointer switching; disabled node commands and deletion confirmation; two skins x two languages x desktop/narrow windows, plus large text.
- First full run: 23 passed, two failed. See `docs/problem.md` for the proven unchanged-resize race and legacy SVG readiness issue. No retries or security bypasses were introduced. The corrected full run passed all 25 cases in 1.4m. The final full run after the last contrast refinement also passed all 25 in 1.4m; final 141-unit rerun passed in 2.90s.
- Isolated event probe: after the resize fix, 30 consecutive keyboard/pointer sequences passed. Regression distinguishes unchanged resize notifications from actual viewport changes.
- Menu text and shortcuts are checked against normal and selected surfaces at >=4.5:1; Calico highlight shortcut uses an existing higher-contrast role. Bounds and text widths are asserted at 1360px and 390px; 20px root text is checked on a 390px screen.

## Visual Evidence

Ignored synthetic screenshots in `Source/test-results/` include:

- `desktop-menu-calico-file.png`, `desktop-menu-calico-node.png`.
- `desktop-menu-{calico,snow-leopard}-{en_US,zh_CN}-{file,help}-{1360,390}.png`.
- `desktop-menu-snow-large-text.png`.

Inspected full desktop file/node menus and Chinese narrow Snow Leopard Help. No text clipping, incoherent overlap or mixed palette was observed. Classic icon gutter, group separators, right-aligned shortcut and compact selection frame are visible; reading/layout surfaces are otherwise retained.

## Preview And Limits

Separate local preview is retained under `Source/dist-release/menu-preview-20261030/linux-unpacked/memgraph`, outside Releases so the latest-three-published-version retention remains exact. It still reports package version 1.0.0-beta.2: it is an unreleased development preview, not the immutable public beta.2 binary. Isolated Linux package smoke passed; all five packaged main/preload/renderer JS/CSS/HTML resources match the final local build. Packaging emits the existing duplicate-reference advisory; no new dependency or public artifact changes.

No commit/push/release, changes to GitHub artifacts, personal-data migration or automatic portable updater were requested. Linux isolated UI tests do not establish real Windows desktop or assistive-technology behavior. Windows native keyboard/accessibility acceptance, screen-reader testing and installed-upgrade tests remain manual gates.
