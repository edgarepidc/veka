import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 40;
const CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING;

export function ImageCarousel({
  images,
  onOpen,
}: {
  images: { id: string; url: string }[];
  onOpen?: (url: string) => void;
}) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    const next = Math.round(offset / CARD_WIDTH);
    setIndex(next);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [images]);

  if (images.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={images}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen?.(item.url)} style={{ width: CARD_WIDTH }}>
            <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
          </Pressable>
        )}
      />
      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((image, dotIndex) => (
            <View
              key={image.id}
              style={[
                styles.dot,
                {
                  backgroundColor: dotIndex === index ? theme.accent : theme.textSubtle,
                  opacity: dotIndex === index ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  image: {
    width: CARD_WIDTH,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
