import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import { themes, type AppTheme, type ThemeMode, type ThemePreference } from '@/constants/theme';

const STORAGE_KEY = 'veka-theme-preference';

interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  }
  return 'light';
}

function resolveSystemMode(): ThemeMode {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference === 'system') return resolveSystemMode();
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const stored = readStoredPreference();
    setPreferenceState(stored);
    setMode(resolveMode(stored));
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => setMode(media.matches ? 'dark' : 'light');
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setMode(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setMode(resolveMode(next));
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const value = useMemo(
    () => ({
      theme: themes[mode],
      mode,
      preference,
      setPreference,
    }),
    [mode, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
  return ctx;
}
