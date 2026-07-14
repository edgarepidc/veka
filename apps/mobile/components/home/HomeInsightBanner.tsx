import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import { SURFACE_RADIUS, surfaceFloatingShadow } from '@/constants/surface';

export type HomeInsightKind = 'paid' | 'due' | 'package' | 'notice' | 'maintenance';

const ILLUSTRATIONS: Record<HomeInsightKind, ImageSourcePropType> = {
  paid: require('@/assets/home/home-insight-paid.png'),
  due: require('@/assets/home/home-insight-due.png'),
  package: require('@/assets/home/home-insight-package.png'),
  notice: require('@/assets/home/home-insight-notice.png'),
  maintenance: require('@/assets/home/home-insight-maintenance.png'),
};

export function HomeInsightBanner({
  kind,
  title,
  subtitle,
  onPress,
}: {
  kind: HomeInsightKind;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const body = (
    <View
      style={[
        styles.card,
        surfaceFloatingShadow(theme),
        {
          backgroundColor: theme.mode === 'dark' ? theme.surfaceMuted : '#F4F3EF',
          borderColor: theme.mode === 'dark' ? theme.border : '#E8E6E0',
        },
      ]}
    >
      <Image source={ILLUSTRATIONS[kind]} style={styles.illustration} resizeMode="cover" />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.wrap}>{body}</View>;
  }

  return (
    <PressableScale onPress={onPress} style={styles.wrap} accessibilityRole="button">
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: SURFACE_RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  illustration: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
});
