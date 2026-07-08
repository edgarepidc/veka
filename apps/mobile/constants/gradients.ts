import type { AppTheme } from '@/constants/theme';

export type ActionGradientVariant = 'blue' | 'purple' | 'orange' | 'green';

/** Preset left-to-right gradient pairs for primary screen actions. */
export function actionGradientColors(
  theme: AppTheme,
  variant: ActionGradientVariant,
): readonly [string, string] {
  switch (variant) {
    case 'purple':
      return [theme.purple, theme.accent];
    case 'orange':
      return [theme.danger, theme.accent3];
    case 'green':
      return [theme.success, theme.accent2];
    case 'blue':
    default:
      return [theme.accent, theme.accent2];
  }
}
