import { useThemeContext } from '@/providers/ThemeProvider';
import type { AppTheme } from '@/constants/theme';

export function useTheme(): AppTheme {
  return useThemeContext().theme;
}

export function useThemePreference() {
  const { preference, setPreference, mode } = useThemeContext();
  return { preference, setPreference, mode };
}
