import { StyleSheet, View, type ViewProps } from 'react-native';

import {
  surfaceCardAccentStyle,
  surfaceCardMutedStyle,
  surfaceCardStyle,
  surfaceCompactShadow,
  surfaceFloatingShadow,
  surfaceNoShadow,
  type SurfaceAccentTone,
} from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';

interface GlassCardProps extends ViewProps {
  padding?: number;
  noPadding?: boolean;
  variant?: 'default' | 'accent' | 'muted';
  accent?: SurfaceAccentTone;
  /** Use compact shadow for small tiles inside horizontal carousels. */
  shadow?: 'default' | 'compact';
}

export function GlassCard({
  children,
  style,
  padding = 16,
  noPadding,
  variant = 'default',
  accent = 'blue',
  shadow = 'default',
  ...props
}: GlassCardProps) {
  const theme = useTheme();

  const cardStyle =
    variant === 'accent'
      ? surfaceCardAccentStyle(theme, accent)
      : variant === 'muted'
        ? surfaceCardMutedStyle(theme)
        : surfaceCardStyle(theme);

  const shadowStyle = shadow === 'compact' ? surfaceCompactShadow(theme) : surfaceFloatingShadow(theme);

  return (
    <View style={[shadowStyle, style]} {...props}>
      <View style={[cardStyle, styles.inner, surfaceNoShadow]}>
        <View style={noPadding ? styles.content : [styles.content, { padding }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
  },
  content: { position: 'relative' },
});
