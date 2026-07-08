import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useMembership } from '@/hooks/useMembership';

export interface UserNotification {
  id: string;
  condominium_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface CommunityNotificationsContextValue {
  notifications: UserNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CommunityNotificationsContext = createContext<CommunityNotificationsContextValue | null>(null);

export function CommunityNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { primary } = useMembership();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !primary?.condominium_id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_notifications')
      .select('id, condominium_id, notification_type, title, body, entity_id, read_at, created_at')
      .eq('user_id', user.id)
      .eq('condominium_id', primary.condominium_id)
      .order('created_at', { ascending: false })
      .limit(30);

    setNotifications((data ?? []) as UserNotification[]);
    setLoading(false);
  }, [primary?.condominium_id, user?.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || !primary?.condominium_id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as UserNotification;
          if (row.condominium_id !== primary.condominium_id) return;
          setNotifications((current) => {
            if (current.some((item) => item.id === row.id)) return current;
            return [row, ...current].slice(0, 30);
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as UserNotification;
          setNotifications((current) => current.map((item) => (item.id === row.id ? row : item)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [primary?.condominium_id, user?.id]);

  const markRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)),
    );
    await supabase.from('user_notifications').update({ read_at: readAt }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.id || !primary?.condominium_id) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    await supabase
      .from('user_notifications')
      .update({ read_at: readAt })
      .eq('user_id', user.id)
      .eq('condominium_id', primary.condominium_id)
      .is('read_at', null);
  }, [primary?.condominium_id, user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markRead,
      markAllRead,
      refresh: load,
    }),
    [notifications, unreadCount, loading, markRead, markAllRead, load],
  );

  return (
    <CommunityNotificationsContext.Provider value={value}>{children}</CommunityNotificationsContext.Provider>
  );
}

export function useCommunityNotifications() {
  const context = useContext(CommunityNotificationsContext);
  if (!context) {
    throw new Error('useCommunityNotifications must be used within CommunityNotificationsProvider');
  }
  return context;
}
