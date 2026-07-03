import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface UserProfile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
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
      .select('full_name, phone, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePhone = useCallback(
    async (phone: string) => {
      if (!user) return { error: 'No autenticado.' };

      const trimmed = phone.trim();
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          phone: trimmed || null,
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

  return { profile, loading, refresh, updatePhone };
}
