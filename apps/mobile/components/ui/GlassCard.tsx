import { StyleSheet, View, type ViewProps } from 'react-native';

import {
  surfaceCardAccentStyle,
  surfaceCardMutedStyle,
  surfaceCardStyle,
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
}

export function GlassCard({
  children,
  style,
  padding = 16,
  noPadding,
  variant = 'default',
  accent = 'blue',
  ...props
}: GlassCardProps) {
  const theme = useTheme();

  const cardStyle =
    variant === 'accent'
      ? surfaceCardAccentStyle(theme, accent)
      : variant === 'muted'
        ? surfaceCardMutedStyle(theme)
        : surfaceCardStyle(theme);

  return (
    <View style={[surfaceFloatingShadow(theme), style]} {...props}>
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
