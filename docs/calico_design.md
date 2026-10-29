# Calico Design

## Architecture

Electron/React/TypeScript desktop renderer, React Flow canvas, Lucide icons and local UI primitives. No Tailwind, shadcn or new dependencies. One light theme replaces the previous green theme; native operating-system dialogs remain native.

`Source/renderer/tokens.css` is the sole color source. Global CSS consumes semantic roles, and graph SVG attributes reference the same CSS variables. Primary fills and readable accent text are separate roles: apricot is not used as small text on light surfaces. Success, warning, danger and information retain distinct colors.

## Visual Rules

- Cream workspace/canvas, warm-white reading and modal surfaces, restrained beige secondary surfaces. Apricot identifies primary actions, pale apricot identifies selection, charcoal anchors typography and code/output blocks.
- Primary apricot/charcoal text contrast is 6.87:1; hover is 4.88:1. Strong accent `#8A4B20` is used for links/focus. Input boundaries use `#8A7765`; quiet separators use `#E7DED3`. Beige surfaces require `--text-on-muted`, not the lighter secondary text.
- System font stack retained. Reading text is 16px at the default root size; UI remains compact. Spacing tokens follow 4/8/12/16/24/32px; controls use 6px corners, nodes/modals 8px. Workbench sections remain contiguous panels, not nested cards.
- Only the brand area and empty canvas have a short asymmetrical three-color rule. No animal imagery, hero section, decorative blobs or external media requests.
- Primary hover uses an opacity layer over 180ms; graph camera uses 180/220ms, zero duration under reduced-motion. No animated layout dimensions or node positions.
- Markdown tables/code scroll locally; rendered wrappers never modify copied/exported source Markdown. HTML/images/external-link security behavior is unchanged.

## Responsive And Accessibility

Desktop minimum size remains unchanged. Below 880px maps use the existing drawer; below 660px details use a drawer and template management stacks vertically. Collapsed navigation keeps translated accessible names. Modal actions remain outside scrollable bodies.

Regression coverage uses actual computed browser colors, graph strokes/arrow fills, control focus, long text and 1360/960/768/390px viewports. Operating-system dark preference does not turn this light-only theme dark. WCAG AA text target is 4.5:1, required focus/control boundaries 3:1. Disabled controls and purely decorative separators are not treated as body text.

## Compatibility

No schema, IPC, model, credentials, routing, update-policy or database changes belong to this visual upgrade. The previous uncommitted manual/automatic updater work is preserved. The implementation-stage evidence is recorded in `test/calico-20261029.md`. Calico and updater features subsequently shipped in 1.0.0-beta.1; publication, current backup retention and remaining manual gates are recorded in `test/release-1.0.0-beta.1.md`.
