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
import { SURFACE_RADIUS } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';

interface PaymentActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function PaymentActionButton({
  label,
  icon,
  colors,
  loading,
  disabled,
  style,
  onPress,
}: PaymentActionButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  return (
    <PressableScale
      disabled={inactive}
      onPress={onPress}
      style={[styles.wrap, inactive && styles.inactive, style]}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name={icon} size={20} color={theme.onAccent} />
            </View>
            <Text style={[styles.label, { fontFamily: theme.sansFamily, color: theme.onAccent }]}>
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
    borderRadius: SURFACE_RADIUS.button,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  inactive: { opacity: 0.45 },
  gradient: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  label: { fontSize: 15, fontWeight: '700' },
});
