import { Platform, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';

export const SURFACE_RADIUS = {
  card: 14,
  button: 12,
  input: 12,
  pill: 999,
  sheet: 20,
} as const;

/** Visible card border — slightly stronger than hairline so sections don't get lost. */
export const SURFACE_BORDER_WIDTH = 1;

export function surfaceShadow(theme: AppTheme): ViewStyle {
  return {
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.05 : theme.mode === 'dark' ? 0.2 : 0.08,
    shadowRadius: 10,
    elevation: 2,
  };
}

export function surfaceCardStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.card,
    overflow: 'hidden',
    ...surfaceShadow(theme),
  };
}

export function surfaceBarStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.sheet,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'web' ? 0.06 : theme.mode === 'dark' ? 0.25 : 0.1,
    shadowRadius: 14,
    elevation: 4,
  };
}

export function surfaceInputStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.input,
    borderColor: theme.inputBorder,
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.input,
    overflow: 'hidden',
  };
}
