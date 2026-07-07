import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/hooks/useTheme';

interface AmenityCardProps {
  name: string;
  scopeLabel: string;
  hoursLabel: string;
  imageUri: string | null;
  fallbackEmoji: string;
  availabilityLabel?: string | null;
  availabilityLoading?: boolean;
  requiresApproval?: boolean;
  onPress: () => void;
}

export function AmenityCard({
  name,
  scopeLabel,
  hoursLabel,
  imageUri,
  fallbackEmoji,
  availabilityLabel,
  availabilityLoading,
  requiresApproval,
  onPress,
}: AmenityCardProps) {
  const theme = useTheme();
  const isFull = availabilityLabel === 'Lleno hoy';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          shadowColor: theme.shadow,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={styles.emoji}>{fallbackEmoji}</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: theme.textSubtle }]} numberOfLines={1}>
          {scopeLabel} · {hoursLabel}
        </Text>

        {requiresApproval ? (
          <Tag label="Requiere aprobación" tone="orange" />
        ) : null}

        <View style={styles.footer}>
          {availabilityLoading ? (
            <Text style={[styles.availability, { color: theme.textSubtle }]}>Consultando…</Text>
          ) : availabilityLabel ? (
            <Text
              style={[
                styles.availability,
                { color: isFull ? theme.textSubtle : theme.accent, fontWeight: isFull ? '500' : '600' },
              ]}
            >
              {availabilityLabel}
            </Text>
          ) : null}
          <Text style={[styles.chevron, { color: theme.accent }]}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const CARD_WIDTH = 260;

export const AMENITY_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'web' ? 0.06 : 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
  },
  imageFallback: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 36 },
  body: { padding: 14, gap: 6 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  meta: { fontSize: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  availability: { fontSize: 13, flex: 1 },
  chevron: { fontSize: 22, fontWeight: '300', marginLeft: 8 },
});
