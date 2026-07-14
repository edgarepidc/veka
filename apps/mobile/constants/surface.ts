import { Platform, StyleSheet, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';

export const SURFACE_RADIUS = {
  card: 16,
  button: 12,
  action: 14,
  input: 12,
  pill: 999,
  sheet: 20,
} as const;

/** Hairline border — depth comes mainly from the soft shadow. */
export const SURFACE_BORDER_WIDTH = StyleSheet.hairlineWidth;

export type SurfaceAccentTone = 'blue' | 'green' | 'orange' | 'purple' | 'danger';

export function surfaceBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? theme.border : '#EBEBEB';
}

export function accentColor(theme: AppTheme, tone: SurfaceAccentTone): string {
  const map: Record<SurfaceAccentTone, string> = {
    blue: theme.accent,
    green: theme.success,
    orange: theme.accent3,
    purple: theme.purple,
    danger: theme.danger,
  };
  return map[tone];
}

/** Soft floating shadow inspired by Airbnb cards. */
export function surfaceFloatingShadow(theme: AppTheme): ViewStyle {
  const isDark = theme.mode === 'dark';
  return {
    shadowColor: isDark ? '#000000' : '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'web' ? 0.07 : isDark ? 0.32 : 0.11,
    shadowRadius: 20,
    elevation: Platform.OS === 'android' ? 5 : 0,
  };
}

/** Tighter shadow for compact carousel tiles — less bleed, less clipping. */
export function surfaceCompactShadow(theme: AppTheme): ViewStyle {
  const isDark = theme.mode === 'dark';
  return {
    shadowColor: isDark ? '#000000' : '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.06 : isDark ? 0.26 : 0.09,
    shadowRadius: 10,
    elevation: Platform.OS === 'android' ? 3 : 0,
  };
}

/** Softer than compact — for dense home pills. */
export function surfaceSubtleShadow(theme: AppTheme): ViewStyle {
  const isDark = theme.mode === 'dark';
  return {
    shadowColor: isDark ? '#000000' : '#1E293B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: Platform.OS === 'web' ? 0.04 : isDark ? 0.18 : 0.05,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 1 : 0,
  };
}

export function surfaceShadow(theme: AppTheme): ViewStyle {
  return surfaceFloatingShadow(theme);
}

export function surfaceCardStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: surfaceBorderColor(theme),
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.card,
    ...surfaceFloatingShadow(theme),
  };
}

export function surfaceCardAccentStyle(theme: AppTheme, tone: SurfaceAccentTone): ViewStyle {
  const color = accentColor(theme, tone);
  const isDark = theme.mode === 'dark';

  return {
    ...surfaceCardStyle(theme),
    backgroundColor: isDark ? `${color}14` : `${color}0A`,
    borderColor: isDark ? `${color}38` : `${color}22`,
    borderLeftWidth: 3,
    borderLeftColor: color,
  };
}

/** Subtle tinted surface — like Airbnb's off-white promo blocks. */
export function surfaceCardMutedStyle(theme: AppTheme): ViewStyle {
  return {
    ...surfaceCardStyle(theme),
    backgroundColor: theme.surfaceMuted,
    borderColor: surfaceBorderColor(theme),
  };
}

export function surfaceAccentBanner(theme: AppTheme, tone: SurfaceAccentTone): ViewStyle {
  const color = accentColor(theme, tone);
  const isDark = theme.mode === 'dark';

  return {
    backgroundColor: isDark ? `${color}18` : `${color}10`,
    borderColor: isDark ? `${color}40` : `${color}26`,
    borderWidth: SURFACE_BORDER_WIDTH,
    borderLeftWidth: 3,
    borderLeftColor: color,
    borderRadius: SURFACE_RADIUS.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
  };
}

export function surfaceBarStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: surfaceBorderColor(theme),
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.sheet,
    ...surfaceFloatingShadow(theme),
  };
}

export function surfaceInputStyle(theme: AppTheme): ViewStyle {
  return {
    backgroundColor: theme.input,
    borderColor: theme.inputBorder,
    borderWidth: SURFACE_BORDER_WIDTH,
    borderRadius: SURFACE_RADIUS.input,
  };
}

export const surfaceNoShadow: ViewStyle = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};
