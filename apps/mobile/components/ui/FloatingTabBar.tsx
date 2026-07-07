import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { TabBarIcon } from '@/components/ui/TabBarIcon';
import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassInnerBorderColor,
  glassOverlay,
} from '@/constants/glass';
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

function TabGlassLens({
  layouts,
  activeIndex,
}: {
  layouts: TabLayout[];
  activeIndex: number;
}) {
  const theme = useTheme();
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';
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

  const lensFill =
    theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.72)';
  const lensBlur = glassBlurIntensity(theme, 'chip') + (theme.mode === 'dark' ? 8 : 12);

  return (
    <Animated.View pointerEvents="none" style={[styles.lens, lensStyle]}>
      {useBlur ? (
        <BlurView
          intensity={lensBlur}
          tint={glassBlurTint(theme)}
          style={[StyleSheet.absoluteFill, { borderRadius: GLASS_RADIUS.button }]}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: lensFill, borderRadius: GLASS_RADIUS.button },
        ]}
      />
      <View
        style={[
          styles.lensHighlight,
          { borderColor: glassInnerBorderColor(theme), borderRadius: GLASS_RADIUS.button },
        ]}
      />
    </Animated.View>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';
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
      <View
        style={[
          styles.bar,
          {
            borderColor: glassBorderColor(theme),
            backgroundColor: Platform.OS === 'web' ? glassOverlay(theme, 'bar') : 'transparent',
            shadowColor: theme.shadow,
          },
        ]}
      >
        {useBlur ? (
          <BlurView
            intensity={glassBlurIntensity(theme, 'bar')}
            tint={glassBlurTint(theme)}
            style={[StyleSheet.absoluteFill, { borderRadius: GLASS_RADIUS.sheet }]}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay(theme, 'bar') }]}
        />

        <TabGlassLens layouts={tabLayouts} activeIndex={state.index} />

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
    borderRadius: GLASS_RADIUS.sheet,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 10,
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: GLASS_RADIUS.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    overflow: 'hidden',
    zIndex: 0,
  },
  lensHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    opacity: 0.9,
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
