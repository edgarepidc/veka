import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/hooks/useTheme';
import { SURFACE_RADIUS, surfaceSubtleShadow } from '@/constants/surface';

const CALENDAR_ILLUSTRATION: ImageSourcePropType = require('@/assets/home/home-insight-calendar.png');

export type HomeSpaceItem = {
  id: string;
  name: string;
  when: string;
  imageUrl: string | null;
  status: 'confirmed' | 'pending';
};

export function HomeSpacesCard({
  items,
  onPress,
}: {
  items: HomeSpaceItem[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const hasItems = items.length > 0;
  const visible = items.slice(0, 2);

  return (
    <PressableScale onPress={onPress} style={styles.wrap} accessibilityRole="button">
      <View
        style={[
          styles.card,
          surfaceSubtleShadow(theme),
          {
            backgroundColor: hasItems
              ? theme.mode === 'dark'
                ? `${theme.accent2}22`
                : `${theme.accent2}14`
              : theme.mode === 'dark'
                ? theme.surfaceMuted
                : '#F4F3EF',
            borderColor: hasItems
              ? theme.mode === 'dark'
                ? `${theme.accent2}44`
                : `${theme.accent2}33`
              : theme.mode === 'dark'
                ? theme.border
                : '#E8E6E0',
          },
        ]}
      >
        <View style={styles.header}>
          <Image source={CALENDAR_ILLUSTRATION} style={styles.illustration} resizeMode="cover" />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>Espacios</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]}>
              {hasItems
                ? `${items.length} reserva${items.length === 1 ? '' : 's'} próxima${items.length === 1 ? '' : 's'}`
                : 'Sin reservas próximas. Reserva un espacio cuando lo necesites.'}
            </Text>
          </View>
        </View>

        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.row,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                ]}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: theme.surfaceMuted }]} />
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowWhen, { color: theme.textMuted }]} numberOfLines={1}>
                    {item.when}
                  </Text>
                </View>
                <Tag
                  label={item.status === 'pending' ? 'Pendiente' : 'Activa'}
                  tone={item.status === 'pending' ? 'orange' : 'blue'}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    borderRadius: SURFACE_RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  illustration: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  headerText: { flex: 1, minWidth: 0 },
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
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowWhen: {
    marginTop: 2,
    fontSize: 12,
  },
});
