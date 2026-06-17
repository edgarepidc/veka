import { useCallback, useEffect, useState } from 'react';
import type { MaintenanceTicketCategory, MaintenanceTicketStatus } from '@veka/shared';
import { STORAGE_BUCKETS, maintenanceFilePath } from '@veka/shared';

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

export function useMaintenance(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicketRow[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceScheduleRow[]>([]);
  const [workLogs, setWorkLogs] = useState<MaintenanceWorkLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setTickets([]);
      setSchedules([]);
      setWorkLogs([]);
      setLoading(false);
      return;
    }

    const [ticketsRes, schedulesRes, workLogsRes] = await Promise.all([
      supabase
        .from('maintenance_tickets')
        .select('id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at')
        .eq('unit_id', primary.unit_id)
        .order('created_at', { ascending: false }),
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
        const response = await fetch(input.photoUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.MAINTENANCE_FILES)
          .upload(path, blob, {
            contentType: input.photoMime ?? 'image/jpeg',
            upsert: false,
          });
        if (uploadError) {
          setActionError(uploadError.message);
          return { error: uploadError.message };
        }
        photoUrl = path;
      }

      const { error } = await supabase.from('maintenance_tickets').insert({
        condominium_id: primary.condominium_id,
        unit_id: primary.unit_id,
        created_by: user.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category,
        photo_url: photoUrl,
      });

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [primary, refresh, user],
  );

  const getSignedUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.MAINTENANCE_FILES).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }, []);

  return {
    tickets,
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
