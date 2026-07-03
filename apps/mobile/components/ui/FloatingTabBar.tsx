import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  GLASS_RADIUS,
  glassBlurIntensity,
  glassBlurTint,
  glassBorderColor,
  glassOverlay,
} from '@/constants/glass';
import { useTheme } from '@/hooks/useTheme';

const TAB_ICONS: Record<string, string> = {
  index: '🏠',
  community: '💬',
  spaces: '🏊',
  finance: '💳',
  maintenance: '🔧',
  security: '🔒',
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const useBlur = Platform.OS === 'ios' || Platform.OS === 'android';

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
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: glassOverlay(theme, 'bar') }]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const icon = TAB_ICONS[route.name] ?? '•';

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={[
                styles.item,
                isFocused && {
                  backgroundColor:
                    theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.72)',
                  borderColor: glassBorderColor(theme),
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text style={styles.icon}>{icon}</Text>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '600',
                  color: isFocused ? theme.accent : theme.textSubtle,
                  letterSpacing: 0.3,
                }}
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  item: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 48,
  },
  icon: { fontSize: 18 },
});
