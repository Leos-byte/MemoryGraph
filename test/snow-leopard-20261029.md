# Snow Leopard Skin - 2026-10-29

## Scope And Architecture

Local implementation on main after `7b552bc`. Calico stays default with all original color/dimension values unchanged. Three additional foreground/subtle roles alias those original values. Snow Leopard has a fully scoped color/shadow declaration; shared spacing, typography, geometry and reduced-motion behavior are unchanged.

Main owns profile `Settings.theme` persistence, validates requested IDs and normalizes unknown stored IDs. A shared registry drives IDs/names/window background. The existing custom-protocol HTML response seeds an allowlisted root attribute before CSS/React; no inline script, sync IPC or relaxed CSP. Runtime switching changes the root attribute only, including Portal and SVG descendants.

Settings has one added Skin select under General. Only theme autosaves; model/key/directory and other drafts keep Save/Cancel semantics. Failed writes revert root attribute and selection; ordinary later saves omit theme. No model calls, schema migrations or production test bypasses were added.

## Observed Checks

- Typecheck/build passed, existing bundle-size advisory only.
- 141 unit tests passed in 9 files (2.33s), including migration, strict request validation, theme-only persistence, failure preservation and bootstrap allowlisting.
- 56 release-tool tests passed (1.16s).
- Final complete desktop run: all 21 passed (1.3 minutes), including the original 17 scenarios; no cases were skipped to hide the initial test-assumption failures.
- A final focused restart case also passed (4.3s total), capturing the Chinese Skin selector after scrolling it into view; other full-run screenshots remain retained.
- Desktop cases cover Calico's original 17 flows plus skin round-trip, unsaved-draft isolation, process restart/bootstrap/CSP, real persistence failure via a temporary blocked write path, computed contrast and responsive surfaces. Initial/focused failures and repairs are recorded in docs/problem.md; final result is recorded after completion.
- A complete before/after set of computed root custom properties matches after Calico -> Snow Leopard -> Calico. Workspace sentinel, selected node and graph viewport are retained without page reload. Calico token diff contains only new aliases, not edits to existing palette values.
- Snow text pairs (including primary/hover, muted surfaces, deep links and independent status palettes) target >=4.5:1; real button foreground, graph path and marker fill are checked, not just source variable names.
- Main-protocol HTML contains the saved skin attribute independently of React. Full Electron process restart restores the skin and matching native window background. This structural check avoids relying only on a final screenshot to infer no startup flash.
- Inspected `snow-workspace-desktop.png`, `snow-settings-zh-mobile.png`, `snow-reading-390.png` and `snow-templates-mobile.png`; 1360/960/768/390-width screenshots and recycle/update dialogs are retained under ignored Source/test-results. Text and controls remain readable without incoherent overlap.

## Retained Development App

`Releases/MemGraph-snow-leopard-dev-20261029-linux-x64-unpacked/memgraph` is a separate local development build. Packaged smoke passed with temporary data: startup, two nodes/one edge, SQLite and renderer isolation. It reports the unchanged version 1.0.0-beta.1 and is not the already-published GitHub binary. Existing Releases and Backup copies were not overwritten or removed.

No dependency/version bump, commit/push, PR or public release in this task. Screenshot data is synthetic. Windows OS execution and physical mobile/touch are untested locally. Native title tooltips, file dialogs and OS-painted select popups are outside CSS theme coverage and remain native; ordinary app menus/dialogs/notifications use root theme variables.
