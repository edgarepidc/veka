import { condominiumDayBoundsIso } from '@/lib/condo-day-bounds';
import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface ClusterOption {
  id: string;
  name: string;
}

export interface SecurityUnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
  cluster: { name: string } | null;
}

export interface VisitRow {
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
  unit: {
    identifier: string;
    cluster_id: string | null;
    cluster: { name: string } | null;
  } | null;
}

export interface PackageRow {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  photo_url: string | null;
  status: 'received' | 'delivered' | 'returned';
  received_at: string;
  delivered_at: string | null;
  delivered_to: string | null;
  unit: {
    identifier: string;
    cluster_id: string | null;
    cluster: { name: string } | null;
  } | null;
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadSeguridadData(condominiumId?: string): Promise<{
  visits: VisitRow[];
  packages: PackageRow[];
  units: SecurityUnitOption[];
  clusters: ClusterOption[];
  condominiumId: string;
  timezone: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data: condo } = await supabase
    .from('condominiums')
    .select('timezone')
    .eq('id', condoId)
    .maybeSingle();

  const timezone = condo?.timezone?.trim() || 'America/Mexico_City';
  const { startIso, endIso } = condominiumDayBoundsIso(timezone);

  const [visitsRes, packagesRes, unitsRes, clustersRes] = await Promise.all([
    supabase
      .from('visits')
      .select(
        `
        id, visitor_name, visit_type, valid_from, valid_until, stay_days,
        vehicle_plate, vehicle_model, notes, checked_in_at, checked_out_at,
        unit:units(identifier, cluster_id, cluster:clusters(name))
      `,
      )
      .eq('condominium_id', condoId)
      .lte('valid_from', endIso)
      .gte('valid_until', startIso)
      .order('valid_from'),
    supabase
      .from('packages')
      .select(
        `
        id, carrier, tracking_number, notes, photo_url, status, received_at, delivered_at, delivered_to,
        unit:units(identifier, cluster_id, cluster:clusters(name))
      `,
      )
      .eq('condominium_id', condoId)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(40),
    supabase
      .from('units')
      .select('id, identifier, cluster_id, cluster:clusters(name)')
      .eq('condominium_id', condoId)
      .order('identifier'),
    supabase.from('clusters').select('id, name').eq('condominium_id', condoId).order('name'),
  ]);

  const mapVisit = (raw: Record<string, unknown>): VisitRow => {
    const unitRaw = asSingle(raw.unit as VisitRow['unit'] | VisitRow['unit'][] | null);
    const clusterRaw = unitRaw ? asSingle(unitRaw.cluster) : null;
    return {
      id: String(raw.id),
      visitor_name: String(raw.visitor_name),
      visit_type: raw.visit_type as VisitRow['visit_type'],
      valid_from: String(raw.valid_from),
      valid_until: String(raw.valid_until),
      stay_days: (raw.stay_days as number | null) ?? null,
      vehicle_plate: (raw.vehicle_plate as string | null) ?? null,
      vehicle_model: (raw.vehicle_model as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
      checked_in_at: (raw.checked_in_at as string | null) ?? null,
      checked_out_at: (raw.checked_out_at as string | null) ?? null,
      unit: unitRaw
        ? {
            identifier: unitRaw.identifier,
            cluster_id: unitRaw.cluster_id ?? null,
            cluster: clusterRaw,
          }
        : null,
    };
  };

  const mapPackage = (raw: Record<string, unknown>): PackageRow => {
    const unitRaw = asSingle(raw.unit as PackageRow['unit'] | PackageRow['unit'][] | null);
    const clusterRaw = unitRaw ? asSingle(unitRaw.cluster) : null;
    return {
      id: String(raw.id),
      carrier: (raw.carrier as string | null) ?? null,
      tracking_number: (raw.tracking_number as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
      photo_url: (raw.photo_url as string | null) ?? null,
      status: raw.status as PackageRow['status'],
      received_at: String(raw.received_at),
      delivered_at: (raw.delivered_at as string | null) ?? null,
      delivered_to: (raw.delivered_to as string | null) ?? null,
      unit: unitRaw
        ? {
            identifier: unitRaw.identifier,
            cluster_id: unitRaw.cluster_id ?? null,
            cluster: clusterRaw,
          }
        : null,
    };
  };

  const units = ((unitsRes.data ?? []) as unknown as Record<string, unknown>[]).map((raw) => {
    const clusterRaw = asSingle(raw.cluster as { name: string } | { name: string }[] | null);
    return {
      id: String(raw.id),
      identifier: String(raw.identifier),
      cluster_id: (raw.cluster_id as string | null) ?? null,
      cluster: clusterRaw,
    } satisfies SecurityUnitOption;
  });

  return {
    condominiumId: condoId,
    timezone,
    visits: ((visitsRes.data ?? []) as unknown as Record<string, unknown>[]).map(mapVisit),
    packages: ((packagesRes.data ?? []) as unknown as Record<string, unknown>[]).map(mapPackage),
    units,
    clusters: (clustersRes.data ?? []) as ClusterOption[],
  };
}
