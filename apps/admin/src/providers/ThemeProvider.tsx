'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  readStoredThemePreference,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDocumentTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const stored = readStoredThemePreference();
    const resolved = resolveThemeMode(stored);
    setPreferenceState(stored);
    setMode(resolved);
    applyDocumentTheme(resolved);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = media.matches ? 'dark' : 'light';
      setMode(next);
      applyDocumentTheme(next);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const resolved = resolveThemeMode(next);
    setPreferenceState(next);
    setMode(resolved);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyDocumentTheme(resolved);
  }, []);

  const value = useMemo(() => ({ mode, preference, setPreference }), [mode, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemeProvider');
  return ctx;
}
