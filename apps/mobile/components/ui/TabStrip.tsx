import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface TabStripProps {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}

export function TabStrip({ tabs, active, onChange }: TabStripProps) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && { backgroundColor: theme.surface }]}
          >
            <Text style={{ color: isActive ? theme.text : theme.textSubtle, fontSize: 11, fontWeight: '600' }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface FilterBarProps {
  items: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}

export function FilterBar({ items, active, onChange }: FilterBarProps) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? `${theme.accent}18` : theme.surfaceMuted,
                borderColor: isActive ? `${theme.accent}44` : theme.border,
              },
            ]}
          >
            <Text style={{ color: isActive ? theme.accent : theme.textSubtle, fontSize: 11, fontWeight: '600' }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, borderRadius: 11, paddingVertical: 8, alignItems: 'center' },
  filterRow: { gap: 6, paddingBottom: 2, marginBottom: 14 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
