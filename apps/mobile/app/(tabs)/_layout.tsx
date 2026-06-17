import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabIcon({
  color,
  ios,
  android,
}: {
  color: string;
  ios: string;
  android: string;
}) {
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      tintColor={color}
      size={24}
    />
  );
}

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
            <TabIcon color={color} ios="house.fill" android="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="person.3.fill" android="groups" />
          ),
        }}
      />
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Espacios',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="calendar" android="event" />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finanzas',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="dollarsign.circle.fill" android="payments" />
          ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: 'Seguridad',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="shield.fill" android="security" />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
