import { useCallback, useEffect, useState } from 'react';

import type { UnitRelationship } from '@veka/shared';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface ActiveMembership {
  id: string;
  condominium_id: string;
  unit_id: string | null;
  role: string;
  unit_relationship: UnitRelationship | null;
  condominium: { id: string; name: string; slug: string } | null;
  unit: { id: string; identifier: string; cluster: { id: string; name: string } | null } | null;
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
        unit_relationship,
        condominium:condominiums (id, name, slug),
        unit:units (id, identifier, cluster:clusters (id, name))
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!error && data) {
      const normalized = data.map((row) => {
        const unitRaw = Array.isArray(row.unit) ? row.unit[0] : row.unit;
        const clusterRaw = unitRaw?.cluster;
        const cluster = Array.isArray(clusterRaw) ? clusterRaw[0] : clusterRaw;
        return {
          ...row,
          condominium: Array.isArray(row.condominium) ? row.condominium[0] : row.condominium,
          unit: unitRaw
            ? {
                id: unitRaw.id,
                identifier: unitRaw.identifier,
                cluster: cluster ?? null,
              }
            : null,
        };
      });
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
