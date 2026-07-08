import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

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
  unit: { identifier: string } | null;
}

export interface PackageRow {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  status: 'received' | 'delivered' | 'returned';
  received_at: string;
  delivered_at: string | null;
  unit: { identifier: string } | null;
}

export async function loadSeguridadData(condominiumId?: string): Promise<{
  visits: VisitRow[];
  packages: PackageRow[];
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [visitsRes, packagesRes] = await Promise.all([
    supabase
      .from('visits')
      .select(
        'id, visitor_name, visit_type, valid_from, valid_until, stay_days, vehicle_plate, vehicle_model, notes, checked_in_at, checked_out_at, unit:units(identifier)',
      )
      .eq('condominium_id', condoId)
      .lte('valid_from', endOfDay.toISOString())
      .gte('valid_until', startOfDay.toISOString())
      .order('valid_from'),
    supabase
      .from('packages')
      .select(
        'id, carrier, tracking_number, notes, status, received_at, delivered_at, unit:units(identifier)',
      )
      .eq('condominium_id', condoId)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(40),
  ]);

  const mapUnit = <T extends { unit: { identifier: string } | { identifier: string }[] | null }>(row: T) => ({
    ...row,
    unit: Array.isArray(row.unit) ? (row.unit[0] ?? null) : row.unit,
  });

  return {
    visits: ((visitsRes.data as VisitRow[] | null) ?? []).map((row) => mapUnit(row)),
    packages: ((packagesRes.data as PackageRow[] | null) ?? []).map((row) => mapUnit(row)),
    condominiumId: condoId,
  };
}
