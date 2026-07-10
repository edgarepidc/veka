import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface UserProfile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  show_phone_in_directory: boolean;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, avatar_url, show_phone_in_directory')
      .eq('id', user.id)
      .maybeSingle();

    setProfile(
      data
        ? {
            full_name: data.full_name,
            phone: data.phone,
            avatar_url: data.avatar_url,
            show_phone_in_directory: Boolean(data.show_phone_in_directory),
          }
        : null,
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePhone = useCallback(
    async (phone: string, showPhoneInDirectory?: boolean) => {
      if (!user) return { error: 'No autenticado.' };

      const trimmed = phone.trim();
      const payload: {
        id: string;
        phone: string | null;
        updated_at: string;
        show_phone_in_directory?: boolean;
      } = {
        id: user.id,
        phone: trimmed || null,
        updated_at: new Date().toISOString(),
      };

      if (typeof showPhoneInDirectory === 'boolean') {
        payload.show_phone_in_directory = showPhoneInDirectory;
      }

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (error) return { error: error.message };

      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  const updateShowPhoneInDirectory = useCallback(
    async (showPhoneInDirectory: boolean) => {
      if (!user) return { error: 'No autenticado.' };

      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          show_phone_in_directory: showPhoneInDirectory,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (error) return { error: error.message };

      await refresh();
      return { error: null };
    },
    [refresh, user],
  );

  return { profile, loading, refresh, updatePhone, updateShowPhoneInDirectory };
}
