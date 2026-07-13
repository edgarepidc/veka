import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScopeFilterIconKind, ScopeFilterItem } from '@veka/shared';

import { useTheme } from '@/hooks/useTheme';

const ICONS: Record<
  ScopeFilterIconKind,
  { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }
> = {
  business: { outline: 'business-outline', filled: 'business' },
  layers: { outline: 'layers-outline', filled: 'layers' },
};

interface ScopeFilterBarProps {
  items: ScopeFilterItem[];
  active: string;
  onChange: (key: string) => void;
}

function ScopeChip({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: ScopeFilterIconKind;
  onPress: () => void;
}) {
  const theme = useTheme();
  const iconName = active ? ICONS[icon].filled : ICONS[icon].outline;
  const color = active ? theme.accent : theme.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label === 'Todo' ? 'Todo el fraccionamiento' : label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? `${theme.accent}24` : 'transparent',
        },
      ]}
    >
      <Ionicons name={iconName} size={14} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function ScopeFilterBar({ items, active, onChange }: ScopeFilterBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => (
        <ScopeChip
          key={item.key}
          active={item.key === active}
          label={item.label}
          icon={item.icon}
          onPress={() => onChange(item.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 2, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
