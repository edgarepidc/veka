import { StyleSheet, View, type ViewProps } from 'react-native';

import { SURFACE_BORDER_WIDTH, surfaceCardStyle } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';

interface GlassCardProps extends ViewProps {
  padding?: number;
  noPadding?: boolean;
}

export function GlassCard({ children, style, padding = 16, noPadding, ...props }: GlassCardProps) {
  const theme = useTheme();

  return (
    <View style={[surfaceCardStyle(theme), style]} {...props}>
      <View style={noPadding ? styles.content : [styles.content, { padding }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { position: 'relative' },
});
