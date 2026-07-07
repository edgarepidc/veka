import type { AppTheme } from '@/constants/theme';

export {
  SURFACE_BORDER_WIDTH,
  SURFACE_RADIUS,
  SURFACE_RADIUS as GLASS_RADIUS,
  surfaceBarStyle,
  surfaceCardStyle,
  surfaceInputStyle,
  surfaceShadow,
} from '@/constants/surface';

/** @deprecated Prefer theme.border via surfaceCardStyle */
export function glassBorderColor(theme: AppTheme): string {
  return theme.border;
}

/** @deprecated No longer used — kept for gradual migration */
export function glassInnerBorderColor(theme: AppTheme): string {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
}

/** @deprecated No longer used — kept for gradual migration */
export function glassBlurTint(theme: AppTheme): 'light' | 'dark' | 'default' {
  return theme.mode === 'dark' ? 'dark' : 'light';
}

/** @deprecated No longer used — kept for gradual migration */
export function glassBlurIntensity(_theme: AppTheme, _surface?: string): number {
  return 0;
}

/** @deprecated No longer used — kept for gradual migration */
export function glassOverlay(theme: AppTheme, surface: 'card' | 'bar' | 'input' | 'chip' = 'card'): string {
  if (surface === 'input') return theme.input;
  if (surface === 'chip') return theme.surfaceMuted;
  return theme.surface;
}

export function glassVibrancyFill(theme: AppTheme, accent: string): string {
  return theme.mode === 'dark' ? `${accent}28` : `${accent}1A`;
}
