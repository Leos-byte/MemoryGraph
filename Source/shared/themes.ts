export const themes = [
  { id: 'calico', label: ['三花猫 Calico', 'Calico'], windowBackground: '#FFFFFF' },
  { id: 'snow-leopard', label: ['雪豹 Snow Leopard', 'Snow Leopard'], windowBackground: '#F5F6F4' },
] as const;
export type ThemeId = typeof themes[number]['id'];
export const defaultTheme: ThemeId = 'calico';
export function isThemeId(value: unknown): value is ThemeId { return themes.some(theme => theme.id === value); }
export function resolveTheme(value: unknown): ThemeId { return isThemeId(value) ? value : defaultTheme; }
export function themeBackground(value: unknown) { return themes.find(theme => theme.id === resolveTheme(value))!.windowBackground; }
export function themeHtml(html: string, value: unknown) {
  // Only registered IDs enter this fixed bootstrap attribute, never raw settings text.
  return html.replace('data-theme="calico"', `data-theme="${resolveTheme(value)}"`);
}
