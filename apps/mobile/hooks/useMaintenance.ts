import { useCallback, useEffect, useState } from 'react';
import type { MaintenanceRecurrence, MaintenanceTicketCategory, MaintenanceTicketStatus } from '@veka/shared';
import {
  STORAGE_BUCKETS,
  amenityAppliesToUnitCluster,
  groupRoutinesByWeekday,
  maintenanceFilePath,
} from '@veka/shared';

import { readUriAsArrayBuffer } from '@/lib/storage-upload';
import { notifyNewMaintenanceTicket } from '@/lib/notify-new-maintenance-ticket';
import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export type MaintenanceAppMode = 'resident' | 'staff';

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

export interface MaintenanceRoutineEvidenceRow {
  id: string;
  evidence_date: string;
  image_url: string;
  resolved_url: string;
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
  amenity: { name: string; cluster_id: string | null } | null;
  evidence: MaintenanceRoutineEvidenceRow[];
}

async function resolveMaintenanceFileUrl(path: string): Promise<string | null> {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = await supabase.storage.from(STORAGE_BUCKETS.MAINTENANCE_FILES).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useMaintenance(primary: ActiveMembership | null, mode: MaintenanceAppMode = 'resident') {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicketRow[]>([]);
  const [routines, setRoutines] = useState<MaintenanceRoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id) {
      setTickets([]);
      setRoutines([]);
      setLoading(false);
      return;
    }

    if (mode === 'resident' && !primary.unit_id) {
      setTickets([]);
      setRoutines([]);
      setLoading(false);
      return;
    }

    const ticketsPromise =
      mode === 'resident' && primary.unit_id
        ? supabase
            .from('maintenance_tickets')
            .select('id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at')
            .eq('unit_id', primary.unit_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as MaintenanceTicketRow[], error: null });

    const [ticketsRes, routinesRes] = await Promise.all([
      ticketsPromise,
      supabase
        .from('maintenance_routines')
        .select(
          'id, title, description, day_of_week, recurrence, monthly_day, sort_order, amenity:amenities(name, cluster_id)',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
    ]);

    setTickets((ticketsRes.data as MaintenanceTicketRow[]) ?? []);

    let routineRows = (routinesRes.data ?? []) as unknown as Omit<MaintenanceRoutineRow, 'evidence'>[];

    if (mode === 'resident') {
      const unitClusterId = primary.unit?.cluster?.id ?? null;
      routineRows = routineRows.filter((row) =>
        amenityAppliesToUnitCluster(row.amenity?.cluster_id, unitClusterId),
      );
    }

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
    await Promise.all(
      (routineEvidence ?? []).map(async (row) => {
        const resolved = await resolveMaintenanceFileUrl(row.image_url);
        const list = evidenceByRoutine.get(row.routine_id) ?? [];
        list.push({
          id: row.id,
          evidence_date: row.evidence_date,
          image_url: row.image_url,
          resolved_url: resolved ?? row.image_url,
          sort_order: row.sort_order,
        });
        evidenceByRoutine.set(row.routine_id, list);
      }),
    );

    setRoutines(
      routineRows.map((row) => ({
        ...row,
        evidence: evidenceByRoutine.get(row.id) ?? [],
      })),
    );
    setLoading(false);
  }, [mode, primary?.condominium_id, primary?.unit?.cluster?.id, primary?.unit_id]);

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

  const uploadEvidence = useCallback(
    async (input: {
      routineId: string;
      evidenceDate: string;
      photos: { uri: string; mimeType?: string; name?: string }[];
    }) => {
      if (!user || !primary?.condominium_id) {
        return { error: 'Sin condominio asignado.' };
      }
      if (!input.routineId) return { error: 'Selecciona la actividad.' };
      if (!input.evidenceDate) return { error: 'Indica la fecha del trabajo.' };
      if (input.photos.length === 0) return { error: 'Sube al menos una foto.' };

      setActionError(null);

      const imageUrls: string[] = [];
      for (let index = 0; index < input.photos.length; index += 1) {
        const photo = input.photos[index]!;
        const ext = photo.name?.split('.').pop() ?? 'jpg';
        const fileId = `${Date.now()}-${index}`;
        const path = maintenanceFilePath(primary.condominium_id, 'routine-evidence', fileId, ext);
        const bytes = await readUriAsArrayBuffer(photo.uri);
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.MAINTENANCE_FILES)
          .upload(path, bytes, {
            contentType: photo.mimeType ?? 'image/jpeg',
            upsert: false,
          });
        if (uploadError) {
          setActionError(uploadError.message);
          return { error: uploadError.message };
        }
        imageUrls.push(path);
      }

      const { error } = await supabase.from('maintenance_routine_evidence').insert(
        imageUrls.map((imageUrl, index) => ({
          routine_id: input.routineId,
          evidence_date: input.evidenceDate,
          image_url: imageUrl,
          sort_order: index,
          created_by: user.id,
        })),
      );

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [primary?.condominium_id, refresh, user],
  );

  const getSignedUrl = useCallback(async (path: string) => resolveMaintenanceFileUrl(path), []);

  const routineGroups = groupRoutinesByWeekday(routines);

  return {
    tickets,
    routines,
    routineGroups,
    loading,
    refreshing,
    actionError,
    refresh,
    createTicket,
    uploadEvidence,
    getSignedUrl,
  };
}
