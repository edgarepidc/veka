import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BackgroundGradientWashes } from '@/components/ui/BackgroundGradientWashes';
import { useTheme } from '@/hooks/useTheme';

interface ScreenBackgroundProps extends ViewProps {
  variant?: 'gradient' | 'plain';
}

export function ScreenBackground({ children, style, variant = 'gradient', ...props }: ScreenBackgroundProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';

  if (variant === 'plain') {
    return (
      <View
        style={[styles.root, { backgroundColor: isDark ? theme.background : '#FFFFFF' }, style]}
        {...props}
      >
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  const washes = isDark
    ? [
        { id: 'wash-top', cx: '88%', cy: '4%', rx: '72%', ry: '48%', color: theme.accent, peak: 0.42 },
        { id: 'wash-mid', cx: '8%', cy: '42%', rx: '58%', ry: '40%', color: theme.purple, peak: 0.28 },
        { id: 'wash-bottom', cx: '78%', cy: '88%', rx: '65%', ry: '45%', color: theme.accent2, peak: 0.32 },
      ]
    : [
        { id: 'wash-top', cx: '90%', cy: '2%', rx: '75%', ry: '50%', color: theme.accent, peak: 0.38 },
        { id: 'wash-mid', cx: '5%', cy: '45%', rx: '60%', ry: '42%', color: theme.purple, peak: 0.22 },
        { id: 'wash-bottom', cx: '82%', cy: '92%', rx: '68%', ry: '48%', color: theme.accent2, peak: 0.28 },
      ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...props}>
      <LinearGradient
        colors={
          isDark
            ? (['#060B14', '#0F172A', '#152238', '#111827'] as const)
            : (['#B8D4FF', '#D0E2FF', '#E8F0FF', '#F4F8FF'] as const)
        }
        locations={[0, 0.32, 0.68, 1]}
        style={[StyleSheet.absoluteFill, styles.layer]}
        pointerEvents="none"
      />
      <BackgroundGradientWashes washes={washes} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { zIndex: 0 },
  content: { flex: 1, zIndex: 1 },
});
