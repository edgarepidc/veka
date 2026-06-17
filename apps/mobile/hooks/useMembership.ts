import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface ActiveMembership {
  id: string;
  condominium_id: string;
  unit_id: string | null;
  role: string;
  condominium: { id: string; name: string; slug: string } | null;
  unit: { id: string; identifier: string } | null;
}

export function useMembership() {
  const { user, authSyncVersion } = useAuth();
  const [memberships, setMemberships] = useState<ActiveMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('memberships')
      .select(
        `
        id,
        condominium_id,
        unit_id,
        role,
        condominium:condominiums (id, name, slug),
        unit:units (id, identifier)
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!error && data) {
      const normalized = data.map((row) => ({
        ...row,
        condominium: Array.isArray(row.condominium) ? row.condominium[0] : row.condominium,
        unit: Array.isArray(row.unit) ? row.unit[0] : row.unit,
      }));
      setMemberships(normalized as ActiveMembership[]);
    } else {
      setMemberships([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh, authSyncVersion]);

  const primary = memberships[0] ?? null;

  return { memberships, primary, loading, refresh };
}
