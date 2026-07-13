import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import type {
  MaintenanceRecurrence,
  MaintenanceTicketCategory,
  MaintenanceTicketStatus,
} from '@veka/shared';

export interface ClusterOption {
  id: string;
  name: string;
}

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
  amenity: { name: string; cluster_id: string | null } | null;
  evidence: MaintenanceRoutineEvidenceRow[];
}

export interface MaintenanceTicketAttachmentRow {
  id: string;
  file_url: string;
  file_name: string | null;
  sort_order: number;
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
  unit: {
    identifier: string;
    cluster_id: string | null;
    cluster: { name: string } | null;
  } | null;
  amenity: { name: string; cluster_id: string | null } | null;
  attachments: MaintenanceTicketAttachmentRow[];
}

export interface AmenityOption {
  id: string;
  name: string;
  cluster_id: string | null;
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadMaintenanceData(condominiumId?: string): Promise<{
  tickets: MaintenanceTicketRow[];
  routines: MaintenanceRoutineRow[];
  amenities: AmenityOption[];
  clusters: ClusterOption[];
  condominiumId: string;
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const ticketSelectWithAttachments = `
        id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at,
        unit:units(identifier, cluster_id, cluster:clusters(name)),
        amenity:amenities(name, cluster_id),
        attachments:maintenance_ticket_attachments(id, file_url, file_name, sort_order)
      `;
  const ticketSelectFallback = `
        id, title, description, category, status, photo_url, admin_notes, created_at, resolved_at,
        unit:units(identifier, cluster_id, cluster:clusters(name)),
        amenity:amenities(name, cluster_id)
      `;

  let ticketsRes: { data: unknown[] | null; error: { message: string } | null } = await supabase
    .from('maintenance_tickets')
    .select(ticketSelectWithAttachments)
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: false });

  if (ticketsRes.error) {
    console.error('[loadMaintenanceData] tickets with attachments failed:', ticketsRes.error.message);
    ticketsRes = await supabase
      .from('maintenance_tickets')
      .select(ticketSelectFallback)
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });
  }

  const [routinesRes, amenitiesRes, clustersRes] = await Promise.all([
    supabase
      .from('maintenance_routines')
      .select(
        'id, title, description, day_of_week, recurrence, monthly_day, anchor_date, is_active, sort_order, created_at, amenity:amenities(name, cluster_id)',
      )
      .eq('condominium_id', condoId)
      .order('day_of_week', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('amenities')
      .select('id, name, cluster_id')
      .eq('condominium_id', condoId)
      .eq('is_active', true)
      .order('name'),
    supabase.from('clusters').select('id, name').eq('condominium_id', condoId).order('name'),
  ]);

  if (ticketsRes.error) {
    console.error('[loadMaintenanceData] tickets fallback failed:', ticketsRes.error.message);
  }

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

  const tickets = (ticketsRes.data ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    const unitRaw = asSingle(raw.unit as MaintenanceTicketRow['unit'] | MaintenanceTicketRow['unit'][] | null);
    const clusterRaw = unitRaw ? asSingle(unitRaw.cluster) : null;
    const amenityRaw = asSingle(
      raw.amenity as MaintenanceTicketRow['amenity'] | MaintenanceTicketRow['amenity'][] | null,
    );
    const attachmentsRaw = Array.isArray(raw.attachments)
      ? (raw.attachments as MaintenanceTicketAttachmentRow[])
      : [];

    return {
      id: String(raw.id),
      title: String(raw.title),
      description: (raw.description as string | null) ?? null,
      category: raw.category as MaintenanceTicketCategory,
      status: raw.status as MaintenanceTicketStatus,
      photo_url: (raw.photo_url as string | null) ?? null,
      admin_notes: (raw.admin_notes as string | null) ?? null,
      created_at: String(raw.created_at),
      resolved_at: (raw.resolved_at as string | null) ?? null,
      unit: unitRaw
        ? {
            identifier: unitRaw.identifier,
            cluster_id: unitRaw.cluster_id ?? null,
            cluster: clusterRaw,
          }
        : null,
      amenity: amenityRaw,
      attachments: attachmentsRaw
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    } satisfies MaintenanceTicketRow;
  });

  return {
    condominiumId: condoId,
    tickets,
    routines: routineRows.map((row) => ({
      ...row,
      amenity: asSingle(row.amenity as MaintenanceRoutineRow['amenity'] | MaintenanceRoutineRow['amenity'][] | null),
      evidence: evidenceByRoutine.get(row.id) ?? [],
    })),
    amenities: (amenitiesRes.data ?? []) as AmenityOption[],
    clusters: (clustersRes.data ?? []) as ClusterOption[],
  };
}
