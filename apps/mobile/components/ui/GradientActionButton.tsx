import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { actionGradientColors, type ActionGradientVariant } from '@/constants/gradients';
import { SURFACE_RADIUS } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';

export interface GradientActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: ActionGradientVariant;
  colors?: readonly [string, string];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function GradientActionButton({
  label,
  icon,
  variant = 'blue',
  colors,
  loading,
  disabled,
  style,
  onPress,
}: GradientActionButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const gradientColors = colors ?? actionGradientColors(theme, variant);

  return (
    <PressableScale
      disabled={inactive}
      onPress={onPress}
      style={[styles.wrap, inactive && styles.inactive, style]}
    >
      <LinearGradient
        colors={[...gradientColors]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name={icon} size={20} color={theme.onAccent} />
            </View>
            <Text style={[styles.label, { fontFamily: theme.sansFamily, color: theme.onAccent }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: SURFACE_RADIUS.action,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  inactive: { opacity: 0.45 },
  gradient: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    flexShrink: 0,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '700' },
});
