import { resolveTheme } from '../shared/themes';

export function applyTheme(value: unknown) {
  document.documentElement.dataset.theme = resolveTheme(value);
}
