import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { createClient } from '@/lib/supabase/server';
import { parseSpacesSettings } from '@veka/shared';

export interface ClusterOption {
  id: string;
  name: string;
}

export interface AmenityRow {
  id: string;
  name: string;
  description: string | null;
  cluster_id: string | null;
  cluster: { name: string } | null;
  image_url: string | null;
  max_daily_reservations: number;
  max_monthly_reservations: number;
  max_concurrent_reservations: number;
  slot_duration_minutes: number;
  open_time: string;
  close_time: string;
  requires_approval: boolean;
  restrict_if_overdue: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ReservationRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'pending';
  created_at: string;
  amenity: { name: string } | null;
  unit: { identifier: string } | null;
}

export async function loadEspaciosData(condominiumId?: string): Promise<{
  amenities: AmenityRow[];
  reservations: ReservationRow[];
  clusters: ClusterOption[];
  spacesSettings: ReturnType<typeof parseSpacesSettings>;
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [amenitiesRes, reservationsRes, clustersRes, condoRes] = await Promise.all([
    supabase
      .from('amenities')
      .select(
        'id, name, description, cluster_id, image_url, max_daily_reservations, max_monthly_reservations, max_concurrent_reservations, slot_duration_minutes, open_time, close_time, requires_approval, restrict_if_overdue, is_active, created_at, cluster:clusters(name)',
      )
      .eq('condominium_id', condoId)
      .order('name'),
    supabase
      .from('reservations')
      .select('id, starts_at, ends_at, status, created_at, amenity:amenities(name), unit:units(identifier)')
      .eq('condominium_id', condoId)
      .gte('ends_at', now)
      .order('starts_at')
      .limit(80),
    supabase.from('clusters').select('id, name').eq('condominium_id', condoId).order('name'),
    supabase.from('condominiums').select('settings').eq('id', condoId).maybeSingle(),
  ]);

  const reservations =
    (reservationsRes.data as {
      id: string;
      starts_at: string;
      ends_at: string;
      status: ReservationRow['status'];
      created_at: string;
      amenity: { name: string } | { name: string }[] | null;
      unit: { identifier: string } | { identifier: string }[] | null;
    }[] | null)?.map((row) => ({
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      created_at: row.created_at,
      amenity: Array.isArray(row.amenity) ? (row.amenity[0] ?? null) : row.amenity,
      unit: Array.isArray(row.unit) ? (row.unit[0] ?? null) : row.unit,
    })) ?? [];

  const amenities =
    (amenitiesRes.data as {
      id: string;
      name: string;
      description: string | null;
      cluster_id: string | null;
      image_url: string | null;
      max_daily_reservations: number;
      max_monthly_reservations: number;
      max_concurrent_reservations: number;
      slot_duration_minutes: number;
      open_time: string;
      close_time: string;
      requires_approval: boolean;
      restrict_if_overdue: boolean;
      is_active: boolean;
      created_at: string;
      cluster: { name: string } | { name: string }[] | null;
    }[] | null)?.map((row) => ({
      ...row,
      cluster: Array.isArray(row.cluster) ? (row.cluster[0] ?? null) : row.cluster,
    })) ?? [];

  const settings = parseCondominiumSettings(condoRes.data?.settings);

  return {
    amenities,
    reservations,
    clusters: (clustersRes.data as ClusterOption[] | null) ?? [],
    spacesSettings: parseSpacesSettings(settings),
    condominiumId: condoId,
  };
}
