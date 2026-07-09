export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'veka-theme-preference';

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  if (preference === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (preference === 'light' || preference === 'dark') return preference;
  return 'light';
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'light';
}
