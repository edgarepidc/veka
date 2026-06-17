import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface VisitRow {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visit_type: 'visit' | 'service' | 'rental';
  qr_token: string;
  valid_from: string;
  valid_until: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
}

export interface PackageRow {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  status: 'received' | 'delivered' | 'returned';
  received_at: string;
  notes: string | null;
}

export function useSecurity(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setVisits([]);
      setPackages([]);
      setLoading(false);
      return;
    }

    const [visitsRes, packagesRes] = await Promise.all([
      supabase
        .from('visits')
        .select(
          'id, visitor_name, visitor_phone, visit_type, qr_token, valid_from, valid_until, checked_in_at, checked_out_at, created_at',
        )
        .eq('unit_id', primary.unit_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('packages')
        .select('id, carrier, tracking_number, status, received_at, notes')
        .eq('unit_id', primary.unit_id)
        .order('received_at', { ascending: false })
        .limit(10),
    ]);

    setVisits((visitsRes.data as VisitRow[]) ?? []);
    setPackages((packagesRes.data as PackageRow[]) ?? []);
    setLoading(false);
  }, [primary?.condominium_id, primary?.unit_id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const createVisit = useCallback(
    async (input: {
      visitorName: string;
      visitorPhone?: string;
      visitType: VisitRow['visit_type'];
      hoursValid?: number;
    }) => {
      if (!user || !primary?.condominium_id || !primary.unit_id) {
        return { error: 'Sin unidad asignada.' };
      }

      setActionError(null);
      const now = new Date();
      const until = new Date(now.getTime() + (input.hoursValid ?? 24) * 60 * 60 * 1000);

      const { error } = await supabase.from('visits').insert({
        condominium_id: primary.condominium_id,
        unit_id: primary.unit_id,
        created_by: user.id,
        visitor_name: input.visitorName.trim(),
        visitor_phone: input.visitorPhone?.trim() || null,
        visit_type: input.visitType,
        valid_from: now.toISOString(),
        valid_until: until.toISOString(),
      });

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [primary, refresh, user],
  );

  return {
    visits,
    packages,
    loading,
    refreshing,
    actionError,
    refresh,
    createVisit,
  };
}
