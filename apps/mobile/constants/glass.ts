import type { AppTheme } from '@/constants/theme';

export const GLASS_RADIUS = {
  card: 22,
  button: 18,
  input: 16,
  pill: 999,
  sheet: 28,
} as const;

export function glassBlurTint(theme: AppTheme): 'light' | 'dark' | 'default' {
  return theme.mode === 'dark' ? 'dark' : 'light';
}

export function glassBlurIntensity(theme: AppTheme, surface: 'card' | 'bar' | 'input' | 'chip' = 'card'): number {
  if (theme.mode === 'dark') {
    if (surface === 'bar') return 40;
    if (surface === 'input') return 28;
    if (surface === 'chip') return 24;
    return 36;
  }
  if (surface === 'bar') return 80;
  if (surface === 'input') return 48;
  if (surface === 'chip') return 40;
  return 64;
}

export function glassOverlay(theme: AppTheme, surface: 'card' | 'bar' | 'input' | 'chip' = 'card'): string {
  if (theme.mode === 'dark') {
    if (surface === 'bar') return 'rgba(30, 41, 59, 0.55)';
    if (surface === 'input') return 'rgba(30, 41, 59, 0.66)';
    if (surface === 'chip') return 'rgba(51, 65, 85, 0.58)';
    return 'rgba(30, 41, 59, 0.5)';
  }
  if (surface === 'bar') return 'rgba(255, 255, 255, 0.62)';
  if (surface === 'input') return 'rgba(255, 255, 255, 0.78)';
  if (surface === 'chip') return 'rgba(255, 255, 255, 0.68)';
  return 'rgba(255, 255, 255, 0.55)';
}

export function glassBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.88)';
}

export function glassInnerBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)';
}

export function glassVibrancyFill(theme: AppTheme, accent: string): string {
  return theme.mode === 'dark' ? `${accent}28` : `${accent}1A`;
}
