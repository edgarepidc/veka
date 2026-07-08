import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SURFACE_BORDER_WIDTH, SURFACE_RADIUS } from '@/constants/surface';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/hooks/useTheme';

interface PrimaryButtonProps {
  label: string;
  variant?: 'primary' | 'success' | 'secondary' | 'muted' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function PrimaryButton({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  onPress,
}: PrimaryButtonProps) {
  const theme = useTheme();

  let bg = theme.accent;
  let color = theme.onAccent;
  let borderColor = 'transparent';

  switch (variant) {
    case 'success':
      bg = theme.success;
      color = theme.onAccent;
      break;
    case 'muted':
      bg = theme.surfaceMuted;
      color = theme.textMuted;
      borderColor = theme.border;
      break;
    case 'secondary':
      bg = theme.surface;
      color = theme.text;
      borderColor = theme.border;
      break;
    case 'danger':
      bg = theme.danger;
      color = '#fff';
      break;
    case 'primary':
    default:
      bg = theme.accent;
      color = theme.onAccent;
      break;
  }

  const inactive = disabled || loading;

  return (
    <PressableScale
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        Platform.OS === 'web' ? styles.webButton : undefined,
        inactive && styles.inactive,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: SURFACE_RADIUS.button,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color, fontFamily: theme.sansFamily }]}>{label}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: SURFACE_RADIUS.button,
    borderWidth: SURFACE_BORDER_WIDTH,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  webButton: {
    cursor: 'pointer',
    userSelect: 'none',
  } as ViewStyle,
  inactive: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: '700' },
});
