import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const SOURCES = {
  mark: require('@/assets/brand/veka-mark.png'),
  wordmark: require('@/assets/brand/veka-wordmark.png'),
  horizontal: require('@/assets/brand/veka-lockup-horizontal.png'),
  stacked: require('@/assets/brand/veka-lockup-stacked.png'),
} as const;

type VekaLogoVariant = keyof typeof SOURCES;

const SIZES: Record<VekaLogoVariant, { width: number; height: number }> = {
  mark: { width: 52, height: 52 },
  wordmark: { width: 128, height: 40 },
  horizontal: { width: 240, height: 64 },
  stacked: { width: 180, height: 132 },
};

export function VekaLogo({
  variant = 'stacked',
  framed = true,
  style,
}: {
  variant?: VekaLogoVariant;
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const size = SIZES[variant];

  const image = (
    <Image source={SOURCES[variant]} style={{ width: size.width, height: size.height }} resizeMode="contain" />
  );

  if (!framed) {
    return <View style={style}>{image}</View>;
  }

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: theme.mode === 'light' ? '#000000' : 'rgba(0,0,0,0.55)' },
        style,
      ]}
    >
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
