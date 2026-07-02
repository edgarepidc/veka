import { useCallback, useEffect, useState } from 'react';
import {
  chargeDisplaySubtitle,
  chargeDisplayTitle,
  chargeStatusLabel,
  chargeStatusTone,
  formatCurrency,
} from '@veka/shared';
import type { FeeSourceRef } from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';

export interface DashboardCharge {
  id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  fee_campaign: FeeSourceRef | null;
  recurring_fee: FeeSourceRef | null;
}

function normalizeFeeSource(raw: unknown): FeeSourceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as FeeSourceRef & { cluster?: { name: string } | { name: string }[] | null };
  const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
  return { ...row, cluster: cluster ?? null };
}

export interface DashboardPost {
  id: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  created_at: string;
}

export interface DashboardReservation {
  id: string;
  starts_at: string;
  ends_at: string;
  amenity_name: string;
}

export interface DashboardPackage {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  received_at: string;
}

export interface DashboardData {
  nextCharge: DashboardCharge | null;
  latestPost: DashboardPost | null;
  upcomingReservation: DashboardReservation | null;
  pendingPackage: DashboardPackage | null;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function useDashboard(primary: ActiveMembership | null) {
  const [data, setData] = useState<DashboardData>({
    nextCharge: null,
    latestPost: null,
    upcomingReservation: null,
    pendingPackage: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setData({
        nextCharge: null,
        latestPost: null,
        upcomingReservation: null,
        pendingPackage: null,
      });
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();

    const [chargesRes, postsRes, reservationsRes, packagesRes] = await Promise.all([
      supabase
        .from('charges')
        .select(
          'id, concept, amount, due_date, status, fee_campaign:fee_campaigns(scope, concept, amount, cluster:clusters(name)), recurring_fee:recurring_fees(scope, concept, cluster:clusters(name))',
        )
        .eq('unit_id', primary.unit_id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(1),
      supabase
        .from('posts')
        .select('id, title, body, is_pinned, created_at')
        .eq('condominium_id', primary.condominium_id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('reservations')
        .select('id, starts_at, ends_at, amenity:amenities (name)')
        .eq('unit_id', primary.unit_id)
        .eq('status', 'confirmed')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(1),
      supabase
        .from('packages')
        .select('id, carrier, tracking_number, received_at')
        .eq('unit_id', primary.unit_id)
        .eq('status', 'received')
        .order('received_at', { ascending: false })
        .limit(1),
    ]);

    const reservationRow = reservationsRes.data?.[0] as
      | {
          id: string;
          starts_at: string;
          ends_at: string;
          amenity: { name: string } | { name: string }[] | null;
        }
      | undefined;
    const amenity = reservationRow?.amenity;
    const amenityName = Array.isArray(amenity) ? amenity[0]?.name : amenity?.name;

    const chargeRow = chargesRes.data?.[0] as
      | (Omit<DashboardCharge, 'fee_campaign' | 'recurring_fee'> & {
          fee_campaign?: unknown;
          recurring_fee?: unknown;
        })
      | undefined;

    setData({
      nextCharge: chargeRow
        ? {
            ...chargeRow,
            fee_campaign: normalizeFeeSource(chargeRow.fee_campaign),
            recurring_fee: normalizeFeeSource(chargeRow.recurring_fee),
          }
        : null,
      latestPost: (postsRes.data?.[0] as DashboardPost | undefined) ?? null,
      upcomingReservation: reservationRow
        ? {
            id: reservationRow.id,
            starts_at: reservationRow.starts_at,
            ends_at: reservationRow.ends_at,
            amenity_name: amenityName ?? 'Espacio',
          }
        : null,
      pendingPackage: (packagesRes.data?.[0] as DashboardPackage | undefined) ?? null,
    });
    setLoading(false);
  }, [primary]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    refresh,
    formatShortDate,
    formatDateTime,
    chargeStatusLabel,
    chargeStatusTone,
    chargeDisplayTitle,
    chargeDisplaySubtitle,
    formatCurrency,
  };
}
