# Desktop Menus

Local, unreleased refinement of the existing React menu system. This is not an Aero skin, operating-system compatibility claim or full-shell redesign. It adapts the command hierarchy and precise alignment of [Microsoft's Windows 7 menu guidelines](https://learn.microsoft.com/en-us/windows/win32/uxguide/cmd-menus) to MemGraph's two current skins. Qt UI Design skill used for the interaction/accessibility audit.

## Structure

File contains five commands in three groups: create; import/backup/restore; recycle bin. Help contains five in three groups: check updates; GitHub/email/copy feedback; About. Settings and Templates stay direct actions, so no extra submenu click is introduced. Map rename/export/delete remain only in the map context menu. Node context and More use the same grouped command list, with edit/copy preceding generation/relations and deletion isolated last.

## Presentation

Menus have a narrow shaded icon gutter, shared text alignment, right-aligned actual shortcuts, group separators, 4px outer corners and a subtle highlighted border. Ellipses indicate further input, not merely any command opening a window. Desktop navigation uses text labels; small windows retain labeled-accessible icon controls. All colors derive from existing semantic tokens, so Calico and Snow Leopard keep their palettes. No glass transparency or new color theme is imposed on reading/settings surfaces.

## Interaction

The existing shared Menu component is extended, not replaced by a parallel system. It clamps popups to the viewport, scrolls focused commands into view, skips disabled items, supports arrows/Home/End and prefix search, and restores focus before opening a modal or after Escape. Tab closes the menu and continues normal navigation. Outside clicks preserve the clicked control's focus. File/Help switch on pointer hover while a top menu is open. F10 focuses the navigation, Alt+F/Alt+H open their menus; horizontal navigation never executes Settings/Templates on hover. Disabled commands remain readable and are not accidentally invoked.

## Boundaries

No main-process, bridge, schema, updater, model, credential or dependency changes. Existing confirmation dialogs and command implementations are reused. Packaged beta.2 assets stay immutable; the new menu is not contained in those already released files. Real Windows OS keyboard/accessibility acceptance remains a separate manual gate. See `test/desktop-menus-20261030.md` for observed local verification.
