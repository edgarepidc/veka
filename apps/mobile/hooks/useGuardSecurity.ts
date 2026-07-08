import { useCallback, useEffect, useState } from 'react';
import { parseVisitQrPayload, visitTypeLabelEs } from '@veka/shared';

import { notifyNewPackage } from '@/lib/notify-new-package';
import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface GuardVisitRow {
  id: string;
  visitor_name: string;
  visit_type: 'visit' | 'service' | 'rental';
  valid_from: string;
  valid_until: string;
  stay_days: number | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  notes: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  unit: { identifier: string } | null;
}

export interface GuardPackageRow {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  status: 'received' | 'delivered' | 'returned';
  received_at: string;
  unit: { identifier: string } | null;
}

export interface GuardUnitOption {
  id: string;
  identifier: string;
}

export interface GuardCheckInResult {
  visitorName: string;
  unitIdentifier: string;
  visitType: string;
  validUntil: string;
  alreadyCheckedIn: boolean;
}

export function useGuardSecurity(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<GuardVisitRow[]>([]);
  const [packages, setPackages] = useState<GuardPackageRow[]>([]);
  const [units, setUnits] = useState<GuardUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id) {
      setVisits([]);
      setPackages([]);
      setUnits([]);
      setLoading(false);
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [visitsRes, packagesRes, unitsRes] = await Promise.all([
      supabase
        .from('visits')
        .select(
          'id, visitor_name, visit_type, valid_from, valid_until, stay_days, vehicle_plate, vehicle_model, notes, checked_in_at, checked_out_at, unit:units(identifier)',
        )
        .eq('condominium_id', primary.condominium_id)
        .lte('valid_from', endOfDay.toISOString())
        .gte('valid_until', startOfDay.toISOString())
        .order('valid_from'),
      supabase
        .from('packages')
        .select('id, carrier, tracking_number, notes, status, received_at, unit:units(identifier)')
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'received')
        .order('received_at', { ascending: false })
        .limit(40),
      supabase
        .from('units')
        .select('id, identifier')
        .eq('condominium_id', primary.condominium_id)
        .order('identifier'),
    ]);

    const mapUnit = <T extends { unit: { identifier: string } | { identifier: string }[] | null }>(row: T) => ({
      ...row,
      unit: Array.isArray(row.unit) ? (row.unit[0] ?? null) : row.unit,
    });

    setVisits(
      ((visitsRes.data ?? []) as unknown as GuardVisitRow[]).map((row) => mapUnit(row)),
    );
    setPackages(
      ((packagesRes.data ?? []) as unknown as GuardPackageRow[]).map((row) => mapUnit(row)),
    );
    setUnits((unitsRes.data as GuardUnitOption[]) ?? []);
    setLoading(false);
  }, [primary?.condominium_id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const checkInVisit = useCallback(
    async (payload: string): Promise<{ error?: string; result?: GuardCheckInResult }> => {
      if (!user || !primary?.condominium_id) {
        return { error: 'Sin condominio asignado.' };
      }

      setActionError(null);
      const parsed = parseVisitQrPayload(payload);
      if (!parsed) return { error: 'Código QR o referencia inválida.' };

      const { data: visit, error } = await supabase
        .from('visits')
        .select(
          'id, visitor_name, visit_type, valid_from, valid_until, checked_in_at, checked_out_at, unit:units(identifier)',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('qr_token', parsed.token)
        .maybeSingle();

      if (error) return { error: error.message };
      if (!visit) return { error: 'Visita no encontrada en este condominio.' };

      const unit = Array.isArray(visit.unit) ? visit.unit[0] : visit.unit;
      const unitIdentifier = unit?.identifier ?? '—';
      const now = Date.now();

      if (new Date(visit.valid_from).getTime() > now) {
        return { error: 'Este pase aún no es válido.' };
      }
      if (new Date(visit.valid_until).getTime() < now) {
        return { error: 'Este pase ya expiró.' };
      }
      if (visit.checked_out_at) {
        return { error: 'El visitante ya registró salida.' };
      }

      if (visit.checked_in_at) {
        return {
          result: {
            visitorName: visit.visitor_name,
            visitType: visitTypeLabelEs(visit.visit_type),
            unitIdentifier,
            validUntil: visit.valid_until,
            alreadyCheckedIn: true,
          },
        };
      }

      const { error: updateError } = await supabase
        .from('visits')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: user.id,
        })
        .eq('id', visit.id);

      if (updateError) {
        setActionError(updateError.message);
        return { error: updateError.message };
      }

      await refresh();
      return {
        result: {
          visitorName: visit.visitor_name,
          visitType: visitTypeLabelEs(visit.visit_type),
          unitIdentifier,
          validUntil: visit.valid_until,
          alreadyCheckedIn: false,
        },
      };
    },
    [primary?.condominium_id, refresh, user],
  );

  const checkOutVisit = useCallback(
    async (visitId: string) => {
      if (!visitId) return { error: 'Visita inválida.' };
      setActionError(null);
      const { error } = await supabase
        .from('visits')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', visitId)
        .is('checked_out_at', null)
        .not('checked_in_at', 'is', null);
      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const registerPackage = useCallback(
    async (input: {
      unitId: string;
      carrier?: string;
      trackingNumber?: string;
      notes?: string;
    }) => {
      if (!user || !primary?.condominium_id) {
        return { error: 'Sin condominio asignado.' };
      }
      if (!input.unitId) return { error: 'Selecciona la unidad.' };

      setActionError(null);
      const { data, error } = await supabase
        .from('packages')
        .insert({
          condominium_id: primary.condominium_id,
          unit_id: input.unitId,
          carrier: input.carrier?.trim() || null,
          tracking_number: input.trackingNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          received_by: user.id,
          status: 'received',
        })
        .select('id')
        .single();

      if (error || !data) {
        const message = error?.message ?? 'No se pudo registrar el paquete.';
        setActionError(message);
        return { error: message };
      }

      void notifyNewPackage(data.id);
      await refresh();
      return { error: null };
    },
    [primary?.condominium_id, refresh, user],
  );

  const deliverPackage = useCallback(
    async (packageId: string, deliveredTo?: string) => {
      if (!packageId) return { error: 'Paquete inválido.' };
      setActionError(null);
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_to: deliveredTo?.trim() || null,
        })
        .eq('id', packageId)
        .eq('status', 'received');

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  return {
    visits,
    packages,
    units,
    loading,
    refreshing,
    actionError,
    refresh,
    checkInVisit,
    checkOutVisit,
    registerPackage,
    deliverPackage,
  };
}
