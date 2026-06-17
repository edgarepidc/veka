import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function Avatar({
  initials,
  color,
  size = 34,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
        },
      ]}
    >
      <Text style={{ color, fontSize: size * 0.34, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export function ScreenHeader({
  title,
  highlight,
  subtitle,
}: {
  title: string;
  highlight?: string;
  subtitle?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text, fontFamily: theme.serifFamily }]}>
        {title}
        {highlight ? (
          <Text style={{ color: theme.accent, fontFamily: theme.serifFamily }}> {highlight}</Text>
        ) : null}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.textSubtle }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionLabel({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.sectionLabel}>
      <Text style={[styles.sectionTitle, { color: theme.textSubtle }]}>{title}</Text>
      {action ? (
        <Text onPress={onAction} style={{ color: theme.accent2, fontSize: 11, fontWeight: '500' }}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  subtitle: { fontSize: 12, marginTop: 4 },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
