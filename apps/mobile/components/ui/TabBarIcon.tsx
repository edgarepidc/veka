import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type TabRouteName =
  | 'index'
  | 'community'
  | 'spaces'
  | 'finance'
  | 'maintenance'
  | 'security';

const TAB_ICONS: Record<
  TabRouteName,
  {
    ios: { outline: SFSymbol; filled: SFSymbol };
    ionicon: { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap };
  }
> = {
  index: {
    ios: { outline: 'house', filled: 'house.fill' },
    ionicon: { outline: 'home-outline', filled: 'home' },
  },
  community: {
    ios: { outline: 'bubble.left.and.bubble.right', filled: 'bubble.left.and.bubble.right.fill' },
    ionicon: { outline: 'chatbubble-ellipses-outline', filled: 'chatbubble-ellipses' },
  },
  spaces: {
    ios: { outline: 'calendar', filled: 'calendar.circle.fill' },
    ionicon: { outline: 'calendar-outline', filled: 'calendar' },
  },
  finance: {
    ios: { outline: 'creditcard', filled: 'creditcard.fill' },
    ionicon: { outline: 'card-outline', filled: 'card' },
  },
  maintenance: {
    ios: { outline: 'wrench.and.screwdriver', filled: 'wrench.and.screwdriver.fill' },
    ionicon: { outline: 'construct-outline', filled: 'construct' },
  },
  security: {
    ios: { outline: 'lock.shield', filled: 'lock.shield.fill' },
    ionicon: { outline: 'shield-checkmark-outline', filled: 'shield-checkmark' },
  },
};

interface TabBarIconProps {
  routeName: string;
  focused: boolean;
  size?: number;
}

function VectorFallback({
  name,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function TabBarIcon({ routeName, focused, size = 24 }: TabBarIconProps) {
  const theme = useTheme();
  const config = TAB_ICONS[routeName as TabRouteName];
  const color = focused ? theme.accent : theme.textSubtle;

  if (!config) {
    return <View style={[styles.wrap, styles.fallback, { backgroundColor: color }]} />;
  }

  const ionName = focused ? config.ionicon.filled : config.ionicon.outline;
  const fallback = <VectorFallback name={ionName} color={color} size={size} />;

  if (Platform.OS !== 'ios') {
    return <View style={styles.wrap}>{fallback}</View>;
  }

  return (
    <View style={styles.wrap}>
      <SymbolView
        name={focused ? config.ios.filled : config.ios.outline}
        fallback={fallback}
        size={size}
        tintColor={color}
        weight={focused ? 'semibold' : 'regular'}
        resizeMode="scaleAspectFit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
});
