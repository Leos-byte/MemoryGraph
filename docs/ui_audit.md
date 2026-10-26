# Qt UI Audit

Date: 2026-08-27

Audit method: `qt-ui-design` skill, Qt Widgets desktop checklist, WCAG-oriented keyboard/contrast review, and offscreen screenshots at 1280x780 and 960x640.

## Context

- Target: Linux desktop, resizable rectangular window.
- Design system: Qt Widgets Fusion style with MemGraph semantic color and typography tokens.
- Content priority: knowledge map and canvas; selected-node explanation and generation; management actions.
- Viewing distance: approximately 60 cm.
- Locale and input: Chinese and English, keyboard and mouse. RTL is not currently required.

## Critical

- Fixed: default widget styling did not guarantee a consistent visible focus treatment or semantic contrast. The shared theme now defines focus borders, selected states, disabled states, and light/dark palettes.
- Fixed: generation looked active even when disabled because the primary-button selector overrode the disabled state. Primary disabled styling is now explicit.

## Warnings

- Fixed: seven node actions were displayed at once. Frequent actions remain visible; copy/export/delete/restore use a compact header and More menu.
- Fixed: settings mixed authentication, model, learning, language, and storage in one long form. They are now grouped by task.
- Fixed: maps could load outside the visible viewport. The graph now fits around node bounds with a readability-preserving zoom floor and a Fit Map command.
- Fixed: node states used internal English values and weak visual hierarchy. Nodes now pair localized text with semantic status colors.
- Fixed: long map and template names caused horizontal scrolling. Lists now elide names and expose the full value in a tooltip.
- Fixed: template actions had equal emphasis. Save is the single primary action and Delete uses a danger treatment.

## Opportunities

- Remaining: add cancellation and partial streaming for long AI generation. Current node placeholders and status-bar messages provide non-blocking progress, but generation cannot yet be stopped.
- Remaining: add an in-app theme selector if users need to override the operating-system light/dark setting.
- Remaining: add a dedicated graph navigation toolbar for zoom percentage and one-click fit, beyond the current wheel and context-menu controls.

## Verification

- Chinese and English layouts use expandable controls and avoid fixed text widths.
- Main window verified at 1280x780 and 960x640 without overlapping controls.
- Settings and Template Manager verified through Qt offscreen widget snapshots.
- Destructive map, node, and template actions retain confirmation or recycle-bin recovery.
