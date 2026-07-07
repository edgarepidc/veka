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
  variant?: 'primary' | 'secondary' | 'danger';
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
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const bg = isDanger ? theme.danger : isSecondary ? theme.surface : theme.accent;
  const color = isSecondary ? theme.text : isDanger ? '#fff' : theme.onAccent;
  const borderColor = isSecondary ? theme.border : 'transparent';

  return (
    <PressableScale
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        Platform.OS === 'web' ? styles.webButton : undefined,
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
  label: { fontSize: 15, fontWeight: '700' },
});
