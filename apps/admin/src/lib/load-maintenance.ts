import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import type {
  MaintenanceRecurrence,
  MaintenanceTicketCategory,
  MaintenanceTicketStatus,
} from '@veka/shared';

export interface MaintenanceRoutineEvidenceRow {
  id: string;
  evidence_date: string;
  image_url: string;
  sort_order: number;
}

export interface MaintenanceRoutineRow {
  id: string;
  title: string;
  description: string | null;
  day_of_week: number | null;
  recurrence: MaintenanceRecurrence;
  monthly_day: number | null;
  anchor_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  amenity: { name: string } | null;
  evidence: MaintenanceRoutineEvidenceRow[];
}

export interface MaintenanceTicketRow {
  id: string;
  title: string;
  description: string | null;
  category: MaintenanceTicketCategory;
  status: MaintenanceTicketStatus;
  photo_url: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  unit: { identifier: string } | null;
  amenity: { name: string } | null;
}

export interface AmenityOption {
  id: string;
  name: string;
}

export async function loadMaintenanceData(condominiumId?: string): Promise<{
  tickets: MaintenanceTicketRow[];
  routines: MaintenanceRoutineRow[];
  amenities: AmenityOption[];
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const [ticketsRes, routinesRes, amenitiesRes] = await Promise.all([
    supabase
      .from('maintenance_tickets')
      .select(
        'id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at, unit:units(identifier), amenity:amenities(name)',
      )
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_routines')
      .select(
        'id, title, description, day_of_week, recurrence, monthly_day, anchor_date, is_active, sort_order, created_at, amenity:amenities(name)',
      )
      .eq('condominium_id', condoId)
      .order('day_of_week', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('amenities')
      .select('id, name')
      .eq('condominium_id', condoId)
      .eq('is_active', true)
      .order('name'),
  ]);

  const routineRows = (routinesRes.data ?? []) as unknown as Omit<MaintenanceRoutineRow, 'evidence'>[];
  const routineIds = routineRows.map((row) => row.id);
  const { data: routineEvidence } = routineIds.length
    ? await supabase
        .from('maintenance_routine_evidence')
        .select('id, routine_id, evidence_date, image_url, sort_order')
        .in('routine_id', routineIds)
        .order('evidence_date', { ascending: false })
        .order('sort_order', { ascending: true })
    : { data: [] as { id: string; routine_id: string; evidence_date: string; image_url: string; sort_order: number }[] };

  const evidenceByRoutine = new Map<string, MaintenanceRoutineEvidenceRow[]>();
  for (const row of routineEvidence ?? []) {
    const list = evidenceByRoutine.get(row.routine_id) ?? [];
    list.push({
      id: row.id,
      evidence_date: row.evidence_date,
      image_url: row.image_url,
      sort_order: row.sort_order,
    });
    evidenceByRoutine.set(row.routine_id, list);
  }

  return {
    condominiumId: condoId,
    tickets: (ticketsRes.data ?? []) as unknown as MaintenanceTicketRow[],
    routines: routineRows.map((row) => ({
      ...row,
      evidence: evidenceByRoutine.get(row.id) ?? [],
    })),
    amenities: (amenitiesRes.data ?? []) as AmenityOption[],
  };
}
