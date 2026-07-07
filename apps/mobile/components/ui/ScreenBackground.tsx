import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface ScreenBackgroundProps extends ViewProps {
  /** @deprecated Gradient removed — plain surface background is now the app default. */
  variant?: 'plain' | 'gradient';
}

export function ScreenBackground({ children, style, variant = 'plain', ...props }: ScreenBackgroundProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...props}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
