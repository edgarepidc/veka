import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { isGuardFieldRole, isMaintenanceFieldRole } from '@veka/shared';

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

function resolveExpoProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEas = Constants.easConfig?.projectId as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return fromExtra || fromEas || fromEnv || undefined;
}

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

  const projectId = resolveExpoProjectId();
  const tokenData = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
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

export function openNotificationTarget(
  data: Record<string, unknown> | undefined,
  role?: string | null,
) {
  const screen = typeof data?.screen === 'string' ? data.screen : null;
  const tab = typeof data?.tab === 'string' ? data.tab : undefined;
  const reservationId = typeof data?.reservationId === 'string' ? data.reservationId : undefined;
  const postId = typeof data?.postId === 'string' ? data.postId : undefined;
  const ticketId =
    typeof data?.ticketId === 'string'
      ? data.ticketId
      : typeof data?.ticket_id === 'string'
        ? data.ticket_id
        : undefined;

  const isGuard = role ? isGuardFieldRole(role) : false;
  const isStaff = role ? isMaintenanceFieldRole(role) : false;

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
    if (isGuard) {
      router.push({
        pathname: '/(guard)/security',
        params: tab ? { tab } : undefined,
      });
      return;
    }
    if (tab) {
      router.push({ pathname: '/security', params: { tab } });
    } else {
      router.push('/security');
    }
    return;
  }
  if (screen === 'maintenance') {
    if (isStaff) {
      router.push({
        pathname: '/(staff)/maintenance',
        params: ticketId ? { ticketId, tab: 'tickets' } : { tab: 'tickets' },
      });
      return;
    }
    if (ticketId) {
      router.push({ pathname: '/maintenance', params: { ticketId } });
    } else {
      router.push('/maintenance');
    }
    return;
  }
  if (screen === 'community') {
    if (postId) {
      router.push({ pathname: '/community', params: { postId } });
    } else {
      router.push('/community');
    }
  }
}

export function usePushNotifications(userId: string | null | undefined, role?: string | null) {
  const registeredRef = useRef<string | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

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
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openNotificationTarget(data, roleRef.current);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openNotificationTarget(data, roleRef.current);
    });

    return () => subscription.remove();
  }, []);
}
