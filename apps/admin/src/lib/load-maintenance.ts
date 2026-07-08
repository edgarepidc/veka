import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import type {
  MaintenanceRecurrence,
  MaintenanceTicketCategory,
  MaintenanceTicketStatus,
} from '@veka/shared';

export interface MaintenanceRoutineImageRow {
  id: string;
  image_url: string;
  caption: string | null;
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
  images: MaintenanceRoutineImageRow[];
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

export interface MaintenanceScheduleRow {
  id: string;
  title: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  file_url: string;
  file_name: string | null;
  created_at: string;
  amenity: { name: string } | null;
}

export interface MaintenanceWorkLogRow {
  id: string;
  title: string;
  description: string | null;
  work_date: string;
  photo_url: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  amenity: { name: string } | null;
  ticket: { title: string } | null;
}

export interface AmenityOption {
  id: string;
  name: string;
}

export async function loadMaintenanceData(condominiumId?: string): Promise<{
  tickets: MaintenanceTicketRow[];
  schedules: MaintenanceScheduleRow[];
  routines: MaintenanceRoutineRow[];
  workLogs: MaintenanceWorkLogRow[];
  amenities: AmenityOption[];
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const [ticketsRes, schedulesRes, routinesRes, workLogsRes, amenitiesRes] = await Promise.all([
    supabase
      .from('maintenance_tickets')
      .select(
        'id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at, unit:units(identifier), amenity:amenities(name)',
      )
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_schedules')
      .select(
        'id, title, description, period_start, period_end, file_url, file_name, created_at, amenity:amenities(name)',
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
      .from('maintenance_work_logs')
      .select(
        'id, title, description, work_date, photo_url, file_url, file_name, created_at, amenity:amenities(name), ticket:maintenance_tickets(title)',
      )
      .eq('condominium_id', condoId)
      .order('work_date', { ascending: false }),
    supabase
      .from('amenities')
      .select('id, name')
      .eq('condominium_id', condoId)
      .eq('is_active', true)
      .order('name'),
  ]);

  const routineRows = (routinesRes.data ?? []) as unknown as Omit<MaintenanceRoutineRow, 'images'>[];
  const routineIds = routineRows.map((row) => row.id);
  const { data: routineImages } = routineIds.length
    ? await supabase
        .from('maintenance_routine_images')
        .select('id, routine_id, image_url, caption, sort_order')
        .in('routine_id', routineIds)
        .order('sort_order', { ascending: true })
    : { data: [] as { id: string; routine_id: string; image_url: string; caption: string | null; sort_order: number }[] };

  const imagesByRoutine = new Map<string, MaintenanceRoutineImageRow[]>();
  for (const image of routineImages ?? []) {
    const list = imagesByRoutine.get(image.routine_id) ?? [];
    list.push({
      id: image.id,
      image_url: image.image_url,
      caption: image.caption,
      sort_order: image.sort_order,
    });
    imagesByRoutine.set(image.routine_id, list);
  }

  return {
    condominiumId: condoId,
    tickets: (ticketsRes.data ?? []) as unknown as MaintenanceTicketRow[],
    schedules: (schedulesRes.data ?? []) as unknown as MaintenanceScheduleRow[],
    routines: routineRows.map((row) => ({
      ...row,
      images: imagesByRoutine.get(row.id) ?? [],
    })),
    workLogs: (workLogsRes.data ?? []) as unknown as MaintenanceWorkLogRow[],
    amenities: (amenitiesRes.data ?? []) as AmenityOption[],
  };
}
