import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import type { AppTheme } from '@/constants/theme';
import { SURFACE_RADIUS, surfaceFloatingShadow } from '@/constants/surface';

export type HomeInsightKind =
  | 'paid'
  | 'due'
  | 'package'
  | 'notice'
  | 'maintenance'
  | 'account'
  | 'spaces';

export type HomeInsightTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'purple';

const ILLUSTRATIONS: Record<HomeInsightKind, ImageSourcePropType> = {
  paid: require('@/assets/home/home-insight-paid.png'),
  due: require('@/assets/home/home-insight-calendar.png'),
  package: require('@/assets/home/home-insight-package.png'),
  notice: require('@/assets/home/home-insight-notice.png'),
  maintenance: require('@/assets/home/home-insight-maintenance.png'),
  account: require('@/assets/home/home-insight-paid.png'),
  spaces: require('@/assets/home/home-insight-calendar.png'),
};

function toneColors(theme: AppTheme, tone: HomeInsightTone) {
  const isDark = theme.mode === 'dark';
  const map: Record<HomeInsightTone, string> = {
    neutral: isDark ? theme.surfaceMuted : '#F4F3EF',
    success: isDark ? `${theme.success}22` : `${theme.success}14`,
    warning: isDark ? `${theme.accent3}22` : `${theme.accent3}14`,
    info: isDark ? `${theme.accent2}22` : `${theme.accent2}14`,
    danger: isDark ? `${theme.danger}22` : `${theme.danger}12`,
    purple: isDark ? `${theme.purple}22` : `${theme.purple}12`,
  };
  const borderMap: Record<HomeInsightTone, string> = {
    neutral: isDark ? theme.border : '#E8E6E0',
    success: isDark ? `${theme.success}44` : `${theme.success}33`,
    warning: isDark ? `${theme.accent3}44` : `${theme.accent3}33`,
    info: isDark ? `${theme.accent2}44` : `${theme.accent2}33`,
    danger: isDark ? `${theme.danger}44` : `${theme.danger}30`,
    purple: isDark ? `${theme.purple}44` : `${theme.purple}30`,
  };
  return { backgroundColor: map[tone], borderColor: borderMap[tone] };
}

export function HomeInsightBanner({
  kind,
  title,
  subtitle,
  tone = 'neutral',
  onPress,
}: {
  kind: HomeInsightKind;
  title: string;
  subtitle: string;
  tone?: HomeInsightTone;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);

  const body = (
    <View style={[styles.card, surfaceFloatingShadow(theme), colors]}>
      <Image source={ILLUSTRATIONS[kind]} style={styles.illustration} resizeMode="cover" />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>{title}</Text>
        <Text
          style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]}
          numberOfLines={2}
        >
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
