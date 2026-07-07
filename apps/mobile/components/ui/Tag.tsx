import { StyleSheet, Text, View } from 'react-native';

import { SURFACE_BORDER_WIDTH, SURFACE_RADIUS } from '@/constants/surface';
import { tagColors, type TagTone } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function Tag({ label, tone = 'gray' }: { label: string; tone?: TagTone }) {
  const theme = useTheme();
  const colors = tagColors(theme, tone);

  return (
    <View
      style={[
        styles.tag,
        {
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: SURFACE_RADIUS.pill,
    borderWidth: SURFACE_BORDER_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
