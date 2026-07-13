import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { surfaceCardStyle, surfaceFloatingShadow, surfaceNoShadow } from '@/constants/surface';
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
  layout?: 'carousel' | 'list';
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
  layout = 'carousel',
  onPress,
}: AmenityCardProps) {
  const theme = useTheme();
  const isFull = availabilityLabel === 'Lleno hoy';
  const isList = layout === 'list';

  const imageNode = imageUri ? (
    <Image source={{ uri: imageUri }} style={isList ? styles.listImage : styles.image} resizeMode="cover" />
  ) : (
    <View
      style={[
        isList ? styles.listImageFallback : styles.imageFallback,
        { backgroundColor: theme.surfaceMuted },
      ]}
    >
      <Text style={[styles.emoji, isList && styles.listEmoji]}>{fallbackEmoji}</Text>
    </View>
  );

  const bodyNode = (
    <View style={isList ? styles.listBody : styles.body}>
      <Text
        style={[isList ? styles.listTitle : styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}
        numberOfLines={isList ? 1 : 2}
      >
        {name}
      </Text>
      <Text style={[styles.meta, { color: theme.textSubtle }]} numberOfLines={1}>
        {scopeLabel} · {hoursLabel}
      </Text>

      {requiresApproval ? <Tag label="Requiere aprobación" tone="orange" /> : null}

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
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        !isList ? surfaceFloatingShadow(theme) : null,
        isList ? styles.listWrap : styles.shadowWrap,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View
        style={[
          isList ? [surfaceCardStyle(theme), styles.listCard] : [surfaceCardStyle(theme), styles.card],
          surfaceNoShadow,
        ]}
      >
        {isList ? (
          <View style={styles.listRow}>
            {imageNode}
            {bodyNode}
          </View>
        ) : (
          <>
            {imageNode}
            {bodyNode}
          </>
        )}
      </View>
    </Pressable>
  );
}

const CARD_WIDTH = 260;

export const AMENITY_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  shadowWrap: {
    width: CARD_WIDTH,
  },
  card: {
    width: '100%',
    overflow: 'hidden',
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
  listWrap: {
    width: '100%',
    marginBottom: 10,
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  listRow: {
    flexDirection: 'row',
  },
  listImage: {
    width: 96,
    height: 96,
  },
  listImageFallback: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listEmoji: { fontSize: 28 },
  listBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  listTitle: { fontSize: 15, fontWeight: '700' },
});
