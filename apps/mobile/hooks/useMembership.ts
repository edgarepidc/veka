import { useCallback, useEffect, useState } from 'react';

import type { UnitRelationship } from '@veka/shared';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface CondoBranding {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
}

export interface ActiveMembership {
  id: string;
  condominium_id: string;
  unit_id: string | null;
  role: string;
  unit_relationship: UnitRelationship | null;
  condominium: {
    id: string;
    name: string;
    slug: string;
    branding: CondoBranding | null;
  } | null;
  unit: { id: string; identifier: string; cluster: { id: string; name: string } | null } | null;
}

function parseBranding(settings: unknown): CondoBranding | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const branding = (settings as { branding?: CondoBranding }).branding;
  if (!branding || typeof branding !== 'object') return null;
  return {
    logo_url: branding.logo_url,
    primary_color: branding.primary_color,
    accent_color: branding.accent_color,
  };
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
        condominium:condominiums (id, name, slug, settings),
        unit:units (id, identifier, cluster:clusters (id, name))
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (!error && data) {
      const normalized = data.map((row) => {
        const unitRaw = Array.isArray(row.unit) ? row.unit[0] : row.unit;
        const clusterRaw = unitRaw?.cluster;
        const cluster = Array.isArray(clusterRaw) ? clusterRaw[0] : clusterRaw;
        const condoRaw = Array.isArray(row.condominium) ? row.condominium[0] : row.condominium;
        const condo = condoRaw
          ? {
              id: condoRaw.id as string,
              name: condoRaw.name as string,
              slug: condoRaw.slug as string,
              branding: parseBranding((condoRaw as { settings?: unknown }).settings),
            }
          : null;
        return {
          ...row,
          condominium: condo,
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
