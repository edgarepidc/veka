import { useCallback, useEffect, useState } from 'react';
import {
  RENTAL_OVERDUE_BLOCK_MESSAGE,
  condoBlocksRentalVisitsIfOverdue,
  isRentalBlockedOverdueError,
  normalizeStayDays,
  parseSecuritySettings,
  rentalVisitWindow,
} from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface VisitRow {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visit_type: 'visit' | 'service' | 'rental';
  stay_days: number | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  notes: string | null;
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
  const [blockRentalIfOverdue, setBlockRentalIfOverdue] = useState(false);
  const [unitHasOverdue, setUnitHasOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setVisits([]);
      setPackages([]);
      setBlockRentalIfOverdue(false);
      setUnitHasOverdue(false);
      setLoading(false);
      return;
    }

    const [visitsRes, packagesRes, condoRes, chargesRes] = await Promise.all([
      supabase
        .from('visits')
        .select(
          'id, visitor_name, visitor_phone, visit_type, stay_days, vehicle_plate, vehicle_model, notes, qr_token, valid_from, valid_until, checked_in_at, checked_out_at, created_at',
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
      supabase.from('condominiums').select('settings').eq('id', primary.condominium_id).maybeSingle(),
      supabase
        .from('charges')
        .select('id, status, due_date')
        .eq('unit_id', primary.unit_id)
        .in('status', ['pending', 'overdue']),
    ]);

    const securitySettings = parseSecuritySettings(
      (condoRes.data?.settings as { security?: unknown } | null)?.security,
    );
    setBlockRentalIfOverdue(condoBlocksRentalVisitsIfOverdue(securitySettings));

    const today = new Date().toISOString().slice(0, 10);
    const hasDelinquent = (chargesRes.data ?? []).some(
      (charge) =>
        charge.status === 'overdue' ||
        (charge.status === 'pending' && charge.due_date < today),
    );
    setUnitHasOverdue(hasDelinquent);

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
      stayDays?: number;
      vehiclePlate?: string;
      vehicleModel?: string;
      notes?: string;
    }) => {
      if (!user || !primary?.condominium_id || !primary.unit_id) {
        return { error: 'Sin unidad asignada.' };
      }

      setActionError(null);

      if (input.visitType === 'rental' && blockRentalIfOverdue && unitHasOverdue) {
        setActionError(RENTAL_OVERDUE_BLOCK_MESSAGE);
        return { error: RENTAL_OVERDUE_BLOCK_MESSAGE };
      }

      const now = new Date();
      let validFrom = now.toISOString();
      let validUntil = new Date(now.getTime() + (input.hoursValid ?? 24) * 60 * 60 * 1000).toISOString();
      let stayDays: number | null = null;

      if (input.visitType === 'rental') {
        stayDays = normalizeStayDays(input.stayDays);
        const window = rentalVisitWindow(stayDays, now);
        validFrom = window.validFrom;
        validUntil = window.validUntil;
      }

      const { data, error } = await supabase
        .from('visits')
        .insert({
          condominium_id: primary.condominium_id,
          unit_id: primary.unit_id,
          created_by: user.id,
          visitor_name: input.visitorName.trim(),
          visitor_phone: input.visitorPhone?.trim() || null,
          visit_type: input.visitType,
          stay_days: stayDays,
          vehicle_plate: input.visitType === 'rental' ? input.vehiclePlate?.trim() || null : null,
          vehicle_model: input.visitType === 'rental' ? input.vehicleModel?.trim() || null : null,
          notes: input.notes?.trim() || null,
          valid_from: validFrom,
          valid_until: validUntil,
        })
        .select('id')
        .single();

      if (error || !data) {
        const message = isRentalBlockedOverdueError(error?.message ?? '')
          ? RENTAL_OVERDUE_BLOCK_MESSAGE
          : (error?.message ?? 'No se pudo crear la visita.');
        setActionError(message);
        return { error: message };
      }

      await refresh();
      return { error: null, visitId: data.id as string };
    },
    [blockRentalIfOverdue, primary, refresh, unitHasOverdue, user],
  );

  const rentalBlocked = blockRentalIfOverdue && unitHasOverdue;

  return {
    visits,
    packages,
    loading,
    refreshing,
    actionError,
    rentalBlocked,
    refresh,
    createVisit,
  };
}
