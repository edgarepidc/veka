import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  const theme = useTheme();
  const bg =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.danger
        : theme.surfaceMuted;
  const color =
    variant === 'secondary' ? theme.text : variant === 'primary' ? theme.onAccent : '#fff';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        Platform.OS === 'web' ? styles.webButton : undefined,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? theme.border : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.98 }] : undefined,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color, fontFamily: theme.sansFamily }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  webButton: {
    cursor: 'pointer',
    userSelect: 'none',
  } as ViewStyle,
  label: { fontSize: 15, fontWeight: '700' },
});
