import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/hooks/useTheme';
import { SURFACE_RADIUS, surfaceSubtleShadow } from '@/constants/surface';

const VISIT_ILLUSTRATION: ImageSourcePropType = require('@/assets/home/home-insight-visit.png');

export type HomeVisitItem = {
  id: string;
  name: string;
  when: string;
  typeLabel: string;
  status: 'expected' | 'inside' | 'left';
  statusLabel: string;
};

function statusTone(status: HomeVisitItem['status']): 'blue' | 'green' | 'gray' {
  if (status === 'inside') return 'green';
  if (status === 'left') return 'gray';
  return 'blue';
}

export function HomeVisitsCard({
  items,
  onPress,
}: {
  items: HomeVisitItem[];
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
                ? `${theme.accent}22`
                : `${theme.accent}12`
              : theme.mode === 'dark'
                ? theme.surfaceMuted
                : '#F4F3EF',
            borderColor: hasItems
              ? theme.mode === 'dark'
                ? `${theme.accent}44`
                : `${theme.accent}33`
              : theme.mode === 'dark'
                ? theme.border
                : '#E8E6E0',
          },
        ]}
      >
        <View style={styles.header}>
          <Image source={VISIT_ILLUSTRATION} style={styles.illustration} resizeMode="cover" />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>
              Visitas de hoy
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]}>
              {hasItems
                ? `${items.length} visita${items.length === 1 ? '' : 's'} para hoy`
                : 'Nadie autorizado hoy. Registra una visita cuando la necesites.'}
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
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowWhen, { color: theme.textMuted }]} numberOfLines={1}>
                    {item.typeLabel} · {item.when}
                  </Text>
                </View>
                <Tag label={item.statusLabel} tone={statusTone(item.status)} />
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
