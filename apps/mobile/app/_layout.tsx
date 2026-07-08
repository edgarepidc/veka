import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { isGuardFieldRole, isMaintenanceFieldRole } from '@veka/shared';

import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useMembership } from '@/hooks/useMembership';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { session, loading, user } = useAuth();
  const { primary, loading: membershipLoading } = useMembership();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(user?.id);

  const isMaintenanceApp = Boolean(primary && isMaintenanceFieldRole(primary.role));
  const isGuardApp = Boolean(primary && isGuardFieldRole(primary.role));

  useEffect(() => {
    if (loading || membershipLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inStaffGroup = segments[0] === '(staff)';
    const inGuardGroup = segments[0] === '(guard)';

    if (!session && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    if (session && inAuthGroup) {
      if (isMaintenanceApp) router.replace('/(staff)/maintenance');
      else if (isGuardApp) router.replace('/(guard)/security');
      else router.replace('/');
      return;
    }

    if (session && isMaintenanceApp && !inStaffGroup && segments[0] !== 'account') {
      router.replace('/(staff)/maintenance');
      return;
    }

    if (session && isGuardApp && !inGuardGroup && segments[0] !== 'account') {
      router.replace('/(guard)/security');
      return;
    }

    if (session && !isMaintenanceApp && inStaffGroup) {
      router.replace('/');
      return;
    }

    if (session && !isGuardApp && inGuardGroup) {
      router.replace('/');
    }
  }, [session, loading, membershipLoading, segments, router, isMaintenanceApp, isGuardApp]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(staff)" />
      <Stack.Screen name="(guard)" />
      <Stack.Screen
        name="account"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Mi cuenta',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: 'Info' }} />
    </Stack>
  );
}
