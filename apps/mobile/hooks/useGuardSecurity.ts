import { useCallback, useEffect, useState } from 'react';
import {
  STORAGE_BUCKETS,
  condominiumDayBoundsIso,
  packagePhotoPath,
  parseVisitQrPayload,
  visitTypeLabelEs,
} from '@veka/shared';

import { readUriAsArrayBuffer } from '@/lib/storage-upload';
import { notifyNewPackage } from '@/lib/notify-new-package';
import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface GuardUnitRef {
  identifier: string;
  cluster_id: string | null;
  cluster: { name: string } | null;
}

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
  unit: GuardUnitRef | null;
}

export interface GuardPackageRow {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  photo_url: string | null;
  status: 'received' | 'delivered' | 'returned';
  received_at: string;
  unit: GuardUnitRef | null;
}

export interface GuardUnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
  cluster: { name: string } | null;
}

export interface GuardCheckInResult {
  visitorName: string;
  unitIdentifier: string;
  visitType: string;
  validUntil: string;
  alreadyCheckedIn: boolean;
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapUnitRef(raw: unknown): GuardUnitRef | null {
  const unitRaw = asSingle(raw as GuardUnitRef | GuardUnitRef[] | null);
  if (!unitRaw) return null;
  const cluster = asSingle(unitRaw.cluster);
  return {
    identifier: unitRaw.identifier,
    cluster_id: unitRaw.cluster_id ?? null,
    cluster,
  };
}

export function useGuardSecurity(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<GuardVisitRow[]>([]);
  const [packages, setPackages] = useState<GuardPackageRow[]>([]);
  const [units, setUnits] = useState<GuardUnitOption[]>([]);
  const [timezone, setTimezone] = useState('America/Mexico_City');
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

    const { data: condo } = await supabase
      .from('condominiums')
      .select('timezone')
      .eq('id', primary.condominium_id)
      .maybeSingle();

    const condoTimezone = condo?.timezone?.trim() || 'America/Mexico_City';
    setTimezone(condoTimezone);
    const { startIso, endIso } = condominiumDayBoundsIso(condoTimezone);

    const [visitsRes, packagesRes, unitsRes] = await Promise.all([
      supabase
        .from('visits')
        .select(
          `
          id, visitor_name, visit_type, valid_from, valid_until, stay_days,
          vehicle_plate, vehicle_model, notes, checked_in_at, checked_out_at,
          unit:units(identifier, cluster_id, cluster:clusters(name))
        `,
        )
        .eq('condominium_id', primary.condominium_id)
        .lte('valid_from', endIso)
        .gte('valid_until', startIso)
        .order('valid_from'),
      supabase
        .from('packages')
        .select(
          `
          id, carrier, tracking_number, notes, photo_url, status, received_at,
          unit:units(identifier, cluster_id, cluster:clusters(name))
        `,
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'received')
        .order('received_at', { ascending: false })
        .limit(40),
      supabase
        .from('units')
        .select('id, identifier, cluster_id, cluster:clusters(name)')
        .eq('condominium_id', primary.condominium_id)
        .order('identifier'),
    ]);

    setVisits(
      ((visitsRes.data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        visitor_name: String(row.visitor_name),
        visit_type: row.visit_type as GuardVisitRow['visit_type'],
        valid_from: String(row.valid_from),
        valid_until: String(row.valid_until),
        stay_days: (row.stay_days as number | null) ?? null,
        vehicle_plate: (row.vehicle_plate as string | null) ?? null,
        vehicle_model: (row.vehicle_model as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        checked_in_at: (row.checked_in_at as string | null) ?? null,
        checked_out_at: (row.checked_out_at as string | null) ?? null,
        unit: mapUnitRef(row.unit),
      })),
    );

    setPackages(
      ((packagesRes.data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        carrier: (row.carrier as string | null) ?? null,
        tracking_number: (row.tracking_number as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        photo_url: (row.photo_url as string | null) ?? null,
        status: row.status as GuardPackageRow['status'],
        received_at: String(row.received_at),
        unit: mapUnitRef(row.unit),
      })),
    );

    setUnits(
      ((unitsRes.data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        identifier: String(row.identifier),
        cluster_id: (row.cluster_id as string | null) ?? null,
        cluster: asSingle(row.cluster as { name: string } | { name: string }[] | null),
      })),
    );
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
      photoUri?: string;
      photoMime?: string;
      photoName?: string;
    }) => {
      if (!user || !primary?.condominium_id) {
        return { error: 'Sin condominio asignado.' };
      }
      if (!input.unitId) return { error: 'Selecciona la unidad.' };

      setActionError(null);
      let photoUrl: string | null = null;

      if (input.photoUri) {
        const ext = input.photoName?.split('.').pop() ?? 'jpg';
        const path = packagePhotoPath(primary.condominium_id, `${Date.now()}`, ext);
        const bytes = await readUriAsArrayBuffer(input.photoUri);
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.PACKAGES).upload(path, bytes, {
          contentType: input.photoMime ?? 'image/jpeg',
          upsert: false,
        });
        if (uploadError) {
          setActionError(uploadError.message);
          return { error: uploadError.message };
        }
        photoUrl = path;
      }

      const { data, error } = await supabase
        .from('packages')
        .insert({
          condominium_id: primary.condominium_id,
          unit_id: input.unitId,
          carrier: input.carrier?.trim() || null,
          tracking_number: input.trackingNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          photo_url: photoUrl,
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
    async (packageId: string, deliveredTo: string) => {
      if (!packageId) return { error: 'Paquete inválido.' };
      const recipient = deliveredTo.trim();
      if (!recipient) return { error: 'Indica quién recogió el paquete.' };

      setActionError(null);
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_to: recipient,
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

  const getPackagePhotoUrl = useCallback(async (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.PACKAGES).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }, []);

  return {
    visits,
    packages,
    units,
    timezone,
    loading,
    refreshing,
    actionError,
    refresh,
    checkInVisit,
    checkOutVisit,
    registerPackage,
    deliverPackage,
    getPackagePhotoUrl,
  };
}
