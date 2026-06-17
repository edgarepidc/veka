import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { useThemePreference } from '@/hooks/useTheme';
import type { ThemePreference } from '@/constants/theme';

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
  { key: 'system', label: 'Sistema' },
];

export function AppearancePicker() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {OPTIONS.map((option) => {
        const active = preference === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            onPress={() => setPreference(option.key)}
            style={[
              styles.option,
              active && { backgroundColor: theme.surface, borderColor: theme.accent },
            ]}
          >
            <Text
              style={{
                color: active ? theme.accent : theme.textMuted,
                fontSize: 13,
                fontWeight: active ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 10,
  },
});
