import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].card,
          borderTopColor: Colors[colorScheme].border,
        },
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={color as ColorValue}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.3.fill', android: 'groups', web: 'groups' }}
              tintColor={color as ColorValue}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Espacios',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'calendar', android: 'event', web: 'event' }}
              tintColor={color as ColorValue}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finanzas',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'dollarsign.circle.fill', android: 'payments', web: 'payments' }}
              tintColor={color as ColorValue}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: 'Seguridad',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'shield.fill', android: 'security', web: 'security' }}
              tintColor={color as ColorValue}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
