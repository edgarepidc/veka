import { useCallback, useEffect, useState } from 'react';
import type { MaintenanceRecurrence, MaintenanceTicketCategory, MaintenanceTicketStatus } from '@veka/shared';
import { STORAGE_BUCKETS, groupRoutinesByWeekday, maintenanceFilePath } from '@veka/shared';

import { readUriAsArrayBuffer } from '@/lib/storage-upload';
import { notifyNewMaintenanceTicket } from '@/lib/notify-new-maintenance-ticket';
import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

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
}

export interface MaintenanceRoutineImageRow {
  id: string;
  image_url: string;
  resolved_url: string;
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
  sort_order: number;
  amenity: { name: string } | null;
  images: MaintenanceRoutineImageRow[];
}

export interface MaintenanceScheduleRow {
  id: string;
  title: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  file_url: string;
  amenity: { name: string } | null;
}

export interface MaintenanceWorkLogRow {
  id: string;
  title: string;
  description: string | null;
  work_date: string;
  photo_url: string | null;
  file_url: string | null;
  amenity: { name: string } | null;
}

async function resolveMaintenanceFileUrl(path: string): Promise<string | null> {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = await supabase.storage.from(STORAGE_BUCKETS.MAINTENANCE_FILES).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useMaintenance(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicketRow[]>([]);
  const [routines, setRoutines] = useState<MaintenanceRoutineRow[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceScheduleRow[]>([]);
  const [workLogs, setWorkLogs] = useState<MaintenanceWorkLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setTickets([]);
      setRoutines([]);
      setSchedules([]);
      setWorkLogs([]);
      setLoading(false);
      return;
    }

    const [ticketsRes, routinesRes, schedulesRes, workLogsRes] = await Promise.all([
      supabase
        .from('maintenance_tickets')
        .select('id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at')
        .eq('unit_id', primary.unit_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_routines')
        .select('id, title, description, day_of_week, recurrence, monthly_day, sort_order, amenity:amenities(name)')
        .eq('condominium_id', primary.condominium_id)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
      supabase
        .from('maintenance_schedules')
        .select('id, title, description, period_start, period_end, file_url, amenity:amenities(name)')
        .eq('condominium_id', primary.condominium_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('maintenance_work_logs')
        .select('id, title, description, work_date, photo_url, file_url, amenity:amenities(name)')
        .eq('condominium_id', primary.condominium_id)
        .order('work_date', { ascending: false })
        .limit(20),
    ]);

    setTickets((ticketsRes.data as MaintenanceTicketRow[]) ?? []);

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
      const resolved = await resolveMaintenanceFileUrl(image.image_url);
      const list = imagesByRoutine.get(image.routine_id) ?? [];
      list.push({
        id: image.id,
        image_url: image.image_url,
        resolved_url: resolved ?? image.image_url,
        caption: image.caption,
        sort_order: image.sort_order,
      });
      imagesByRoutine.set(image.routine_id, list);
    }

    setRoutines(
      routineRows.map((row) => ({
        ...row,
        images: imagesByRoutine.get(row.id) ?? [],
      })),
    );
    setSchedules((schedulesRes.data as unknown as MaintenanceScheduleRow[]) ?? []);
    setWorkLogs((workLogsRes.data as unknown as MaintenanceWorkLogRow[]) ?? []);
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

  const createTicket = useCallback(
    async (input: {
      title: string;
      description?: string;
      category: MaintenanceTicketCategory;
      photoUri?: string;
      photoMime?: string;
      photoName?: string;
    }) => {
      if (!user || !primary?.condominium_id || !primary.unit_id) {
        return { error: 'Sin unidad asignada.' };
      }

      setActionError(null);
      let photoUrl: string | null = null;

      if (input.photoUri) {
        const ext = input.photoName?.split('.').pop() ?? 'jpg';
        const fileId = `${Date.now()}`;
        const path = maintenanceFilePath(primary.condominium_id, 'tickets', fileId, ext);
        const bytes = await readUriAsArrayBuffer(input.photoUri);
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.MAINTENANCE_FILES)
          .upload(path, bytes, {
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
        .from('maintenance_tickets')
        .insert({
          condominium_id: primary.condominium_id,
          unit_id: primary.unit_id,
          created_by: user.id,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          category: input.category,
          photo_url: photoUrl,
        })
        .select('id')
        .single();

      if (error || !data) {
        setActionError(error?.message ?? 'No se pudo crear el ticket.');
        return { error: error?.message ?? 'No se pudo crear el ticket.' };
      }

      void notifyNewMaintenanceTicket(data.id);
      await refresh();
      return { error: null, ticketId: data.id };
    },
    [primary, refresh, user],
  );

  const getSignedUrl = useCallback(async (path: string) => resolveMaintenanceFileUrl(path), []);

  const routineGroups = groupRoutinesByWeekday(routines);

  return {
    tickets,
    routines,
    routineGroups,
    schedules,
    workLogs,
    loading,
    refreshing,
    actionError,
    refresh,
    createTicket,
    getSignedUrl,
  };
}
