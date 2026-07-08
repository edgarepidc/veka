import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

async function savePushToken(userId: string, token: string): Promise<void> {
  const platform = Platform.OS;
  const deviceName = Device.modelName ?? null;

  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      device_name: deviceName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
}

function openNotificationTarget(data: Record<string, unknown> | undefined) {
  const screen = typeof data?.screen === 'string' ? data.screen : null;
  const tab = typeof data?.tab === 'string' ? data.tab : undefined;
  const reservationId = typeof data?.reservationId === 'string' ? data.reservationId : undefined;

  if (screen === 'finance') {
    if (tab) {
      router.push({ pathname: '/finance', params: { tab } });
    } else {
      router.push({ pathname: '/finance', params: { tab: 'mi-cuenta' } });
    }
    return;
  }
  if (screen === 'spaces') {
    if (reservationId) {
      router.push({ pathname: '/spaces', params: { reservationId } });
    } else {
      router.push('/spaces');
    }
    return;
  }
  if (screen === 'security') {
    if (tab) {
      router.push({ pathname: '/security', params: { tab } });
    } else {
      router.push('/security');
    }
    return;
  }
  if (screen === 'maintenance') {
    router.push('/maintenance');
    return;
  }
  if (screen === 'community') {
    router.push('/community');
  }
}

export function usePushNotifications(userId: string | null | undefined) {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!token || cancelled || registeredRef.current === token) return;

        await savePushToken(userId, token);
        registeredRef.current = token;
      } catch {
        // Push registration is best-effort (simulator, missing EAS project, etc.)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openNotificationTarget(data);
    });

    return () => subscription.remove();
  }, []);
}
