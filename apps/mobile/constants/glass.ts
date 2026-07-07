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
    if (surface === 'bar') return 55;
    if (surface === 'input') return 40;
    if (surface === 'chip') return 32;
    return 48;
  }
  if (surface === 'bar') return 100;
  if (surface === 'input') return 72;
  if (surface === 'chip') return 56;
  return 88;
}

export function glassOverlay(theme: AppTheme, surface: 'card' | 'bar' | 'input' | 'chip' = 'card'): string {
  if (theme.mode === 'dark') {
    if (surface === 'bar') return 'rgba(30, 41, 59, 0.38)';
    if (surface === 'input') return 'rgba(30, 41, 59, 0.48)';
    if (surface === 'chip') return 'rgba(51, 65, 85, 0.42)';
    return 'rgba(30, 41, 59, 0.32)';
  }
  if (surface === 'bar') return 'rgba(255, 255, 255, 0.38)';
  if (surface === 'input') return 'rgba(255, 255, 255, 0.45)';
  if (surface === 'chip') return 'rgba(255, 255, 255, 0.4)';
  return 'rgba(255, 255, 255, 0.28)';
}

export function glassBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)';
}

export function glassInnerBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.72)';
}

export function glassVibrancyFill(theme: AppTheme, accent: string): string {
  return theme.mode === 'dark' ? `${accent}28` : `${accent}1A`;
}
