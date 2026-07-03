import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function ScreenBackground({ children, style, ...props }: ViewProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...props}>
      <LinearGradient
        colors={
          isDark
            ? (['#0B1220', '#0F172A', '#111827'] as const)
            : (['#DCE8FF', '#EEF2FF', '#F4F6F9', '#F8FAFC'] as const)
        }
        locations={isDark ? undefined : [0, 0.35, 0.7, 1]}
        style={[StyleSheet.absoluteFill, styles.layer]}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbTop,
          { backgroundColor: isDark ? `${theme.accent}22` : `${theme.accent}18` },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbBottom,
          { backgroundColor: isDark ? `${theme.accent2}18` : `${theme.accent2}14` },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { zIndex: 0 },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    zIndex: 0,
  },
  orbTop: {
    width: 280,
    height: 280,
    top: -90,
    right: -100,
  },
  orbBottom: {
    width: 220,
    height: 220,
    bottom: 80,
    left: -80,
  },
  content: { flex: 1, zIndex: 1 },
});
