import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';

export type EmptyStateKind = 'notice' | 'visit' | 'package' | 'units' | 'maintenance';

const ILLUSTRATIONS: Record<EmptyStateKind, ImageSourcePropType> = {
  notice: require('@/assets/home/home-insight-notice.png'),
  visit: require('@/assets/home/home-insight-visit.png'),
  package: require('@/assets/home/home-insight-package.png'),
  units: require('@/assets/home/home-insight-units.png'),
  maintenance: require('@/assets/home/home-insight-maintenance.png'),
};

export function EmptyStateCard({
  kind,
  title,
  subtitle,
  style,
}: {
  kind: EmptyStateKind;
  title: string;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <GlassCard variant="muted" style={style}>
      <View style={styles.row}>
        <Image source={ILLUSTRATIONS[kind]} style={styles.illustration} resizeMode="cover" />
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]}>
            {subtitle}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  illustration: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
});
