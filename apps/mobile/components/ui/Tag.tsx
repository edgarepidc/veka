import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassOverlay,
  glassVibrancyFill,
} from '@/constants/glass';
import { tagColors, type TagTone } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function Tag({ label, tone = 'gray' }: { label: string; tone?: TagTone }) {
  const theme = useTheme();
  const colors = tagColors(theme, tone);
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';
  const vibrancy = glassVibrancyFill(theme, colors.text);

  return (
    <View
      style={[
        styles.tag,
        {
          borderColor: colors.border,
          backgroundColor: useBlur ? 'transparent' : colors.bg,
        },
      ]}
    >
      {useBlur ? (
        <BlurView
          intensity={glassBlurIntensity(theme, 'chip')}
          tint={glassBlurTint(theme)}
          style={[StyleSheet.absoluteFill, { borderRadius: GLASS_RADIUS.pill }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: useBlur ? vibrancy : colors.bg,
            borderRadius: GLASS_RADIUS.pill,
          },
        ]}
      />
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: GLASS_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, zIndex: 1 },
});
