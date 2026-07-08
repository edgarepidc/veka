import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { CommunityNotificationsProvider } from '@/providers/CommunityNotificationsProvider';

export default function TabLayout() {
  return (
    <CommunityNotificationsProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...(props as Parameters<typeof FloatingTabBar>[0])} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
        <Tabs.Screen name="spaces" options={{ title: 'Espacios' }} />
        <Tabs.Screen name="finance" options={{ title: 'Finanzas' }} />
        <Tabs.Screen name="maintenance" options={{ title: 'Mantenimiento' }} />
        <Tabs.Screen name="security" options={{ title: 'Seguridad' }} />
      </Tabs>
    </CommunityNotificationsProvider>
  );
}
