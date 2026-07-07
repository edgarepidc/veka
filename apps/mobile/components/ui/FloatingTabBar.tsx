import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { TabBarIcon } from '@/components/ui/TabBarIcon';
import { SURFACE_RADIUS, surfaceBarStyle } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';

const LENS_SPRING = { damping: 20, stiffness: 260, mass: 0.85 };

type TabLayout = { x: number; width: number };

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

function TabActiveLens({
  layouts,
  activeIndex,
}: {
  layouts: TabLayout[];
  activeIndex: number;
}) {
  const theme = useTheme();
  const lensX = useSharedValue(0);
  const lensWidth = useSharedValue(0);
  const lensOpacity = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[activeIndex];
    if (!layout || layout.width <= 0) return;

    lensX.value = withSpring(layout.x, LENS_SPRING);
    lensWidth.value = withSpring(layout.width, LENS_SPRING);
    lensOpacity.value = withSpring(1, LENS_SPRING);
  }, [activeIndex, layouts, lensOpacity, lensWidth, lensX]);

  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensOpacity.value,
    transform: [{ translateX: lensX.value }],
    width: Math.max(lensWidth.value, 0),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.lens,
        lensStyle,
        {
          backgroundColor: theme.mode === 'dark' ? `${theme.accent}22` : `${theme.accent}12`,
          borderColor: theme.mode === 'dark' ? `${theme.accent}44` : `${theme.accent}28`,
        },
      ]}
    />
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const [tabLayouts, setTabLayouts] = useState<TabLayout[]>([]);

  const onTabLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, surfaceBarStyle(theme)]}>
        <TabActiveLens layouts={tabLayouts} activeIndex={state.index} />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onLayout={(event) => onTabLayout(index, event)}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.item}
            >
              <TabBarIcon routeName={route.name} focused={isFocused} size={23} />
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.accent : theme.textSubtle,
                    fontWeight: isFocused ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: SURFACE_RADIUS.button,
    borderWidth: 1,
    zIndex: 0,
  },
  item: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minWidth: 48,
    zIndex: 1,
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.2,
  },
});
