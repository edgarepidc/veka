import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface SectionCardProps {
  title: string;
  description: string;
  badge?: string;
  badgeTone?: 'default' | 'success' | 'warning' | 'danger';
}

export function SectionCard({
  title,
  description,
  badge,
  badgeTone = 'default',
}: SectionCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const badgeColors = {
    default: { bg: colors.border, text: colors.muted },
    success: { bg: '#D1FAE5', text: colors.success },
    warning: { bg: '#FEF3C7', text: colors.warning },
    danger: { bg: '#FEE2E2', text: colors.danger },
  }[badgeTone];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.text }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
