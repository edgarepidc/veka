import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface AmenityRow {
  id: string;
  name: string;
  description: string | null;
  max_daily_reservations: number;
  max_monthly_reservations: number;
  slot_duration_minutes: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
  created_at: string;
}

export interface ReservationRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  amenity: { name: string } | null;
  unit: { identifier: string } | null;
}

export async function loadEspaciosData(condominiumId?: string): Promise<{
  amenities: AmenityRow[];
  reservations: ReservationRow[];
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [amenitiesRes, reservationsRes] = await Promise.all([
    supabase
      .from('amenities')
      .select(
        'id, name, description, max_daily_reservations, max_monthly_reservations, slot_duration_minutes, open_time, close_time, is_active, created_at',
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

  return {
    amenities: (amenitiesRes.data as AmenityRow[] | null) ?? [],
    reservations,
    condominiumId: condoId,
  };
}
