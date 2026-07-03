import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassInnerBorderColor,
  glassOverlay,
} from '@/constants/glass';
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
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const bg = isDanger ? theme.danger : isSecondary ? 'transparent' : theme.accent;
  const color = isSecondary ? theme.text : isDanger ? '#fff' : theme.onAccent;

  const buttonBody = (
    <>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color, fontFamily: theme.sansFamily }]}>{label}</Text>
      )}
    </>
  );

  if (isSecondary && useBlur) {
    return (
      <PressableScale disabled={disabled || loading} onPress={onPress} style={[styles.wrapper, style]}>
        <View
          style={[
            styles.button,
            {
              borderColor: glassBorderColor(theme),
              borderRadius: GLASS_RADIUS.button,
            },
          ]}
        >
          <BlurView
            intensity={glassBlurIntensity(theme, 'chip')}
            tint={glassBlurTint(theme)}
            style={[StyleSheet.absoluteFill, { borderRadius: GLASS_RADIUS.button }]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: glassOverlay(theme, 'chip'),
                borderRadius: GLASS_RADIUS.button,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.innerHighlight,
              { borderColor: glassInnerBorderColor(theme), borderRadius: GLASS_RADIUS.button },
            ]}
          />
          <View style={styles.content}>{buttonBody}</View>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        Platform.OS === 'web' ? styles.webButton : undefined,
        {
          backgroundColor: bg,
          borderColor: isSecondary ? glassBorderColor(theme) : 'transparent',
          borderRadius: GLASS_RADIUS.button,
        },
        style,
      ]}
    >
      {buttonBody}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  button: {
    borderRadius: GLASS_RADIUS.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  innerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    opacity: 0.9,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 13,
    zIndex: 1,
  },
  webButton: {
    cursor: 'pointer',
    userSelect: 'none',
  } as ViewStyle,
  label: { fontSize: 15, fontWeight: '700' },
});
