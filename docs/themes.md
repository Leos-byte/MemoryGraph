# UI Skins

Calico remains the default. Snow Leopard is an additional light skin, not a layout replacement. No dependency, database or model changes are needed.

`Source/shared/themes.ts` registers IDs, localized names and native window backgrounds. Types/settings validation derive from this registry. Add a registry item, a statically imported scoped CSS file and tests for future skins. Arbitrary stylesheet URLs are not accepted.

Calico's tokens remain unchanged; three new roles alias its original values. Snow Leopard declares all color/shadow roles under `:root[data-theme='snow-leopard']` only. Geometry, fonts and motion are shared. Root scope includes Portal menus/dialogs/toasts and graph SVGs. Native title tooltips, file dialogs and system-drawn select popups retain OS rendering.

Settings > General > Skin immediately applies and autosaves only `{ theme }` through existing `settings.save`. Other settings remain Save/Cancel drafts; later saving them cannot overwrite theme. Writes are serialized and failure reverts to the previous skin with the existing error notification.

The normal profile settings.json is authoritative; no localStorage mirror or second provider is introduced. Missing/unknown stored IDs fall back to Calico, but invalid theme requests are rejected. Other settings keep existing validation. Main seeds an allowlisted HTML attribute before paint and matches the window background; React keeps that seed until the actual snapshot. No new synchronous IPC, inline script or weakened CSP.

Snow primary uses white text (5.04:1, hover 7.31:1). Auxiliary text uses #66716C instead of the suggested #707A76, which fails AA on light surfaces. Muted/selected surfaces use #596360. Focus/link is #405C53; required control outlines #75857F; deep-output links #B8CEC5. Semantic status colors remain independent.

The feature was published in 1.0.0-beta.2 at the owner's request, after Windows/Linux CI, formal builds and independent signed-metadata verification passed. Publication evidence is tracked in `test/release-1.0.0-beta.2.md`. Never overwrite earlier public assets or clean existing backups as part of skin work.
