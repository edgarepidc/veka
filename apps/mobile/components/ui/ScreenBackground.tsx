import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function ScreenBackground({ children, style, ...props }: ViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...props}>
      <LinearGradient
        colors={[...theme.gradient]}
        style={[StyleSheet.absoluteFill, styles.layer]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { zIndex: 0 },
  content: { flex: 1, zIndex: 1 },
});
