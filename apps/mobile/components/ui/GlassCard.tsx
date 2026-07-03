import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassInnerBorderColor,
  glassOverlay,
} from '@/constants/glass';
import { useTheme } from '@/hooks/useTheme';

interface GlassCardProps extends ViewProps {
  padding?: number;
  noPadding?: boolean;
}

export function GlassCard({ children, style, padding = 16, noPadding, ...props }: GlassCardProps) {
  const theme = useTheme();
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: glassBorderColor(theme),
          shadowColor: theme.shadow,
          borderRadius: GLASS_RADIUS.card,
        },
        style,
      ]}
      {...props}
    >
      {useBlur ? (
        <BlurView
          intensity={glassBlurIntensity(theme, 'card')}
          tint={glassBlurTint(theme)}
          style={[StyleSheet.absoluteFill, { borderRadius: GLASS_RADIUS.card }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: glassOverlay(theme, 'card'), borderRadius: GLASS_RADIUS.card },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.innerHighlight,
          { borderColor: glassInnerBorderColor(theme), borderRadius: GLASS_RADIUS.card },
        ]}
      />
      <View style={noPadding ? styles.content : [styles.content, { padding }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'web' ? 0.06 : 0.16,
    shadowRadius: 24,
    elevation: 5,
  },
  innerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    opacity: 0.95,
  },
  content: { position: 'relative', zIndex: 1 },
});
