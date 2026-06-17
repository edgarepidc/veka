import { StyleSheet, Text, View } from 'react-native';

import { tagColors, type TagTone } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function Tag({ label, tone = 'gray' }: { label: string; tone?: TagTone }) {
  const theme = useTheme();
  const colors = tagColors(theme, tone);

  return (
    <View style={[styles.tag, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: { fontSize: 10, fontWeight: '700' },
});
