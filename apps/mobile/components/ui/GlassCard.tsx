import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface GlassCardProps extends ViewProps {
  padding?: number;
  noPadding?: boolean;
}

export function GlassCard({ children, style, padding = 16, noPadding, ...props }: GlassCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        noPadding ? undefined : { padding },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.06 : 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
});
