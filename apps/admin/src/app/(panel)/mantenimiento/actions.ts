'use server';

import { revalidatePath } from 'next/cache';
import type { MaintenanceTicketStatus } from '@veka/shared';
import {
  MAINTENANCE_RECURRENCES,
  MAINTENANCE_ROUTINE_TEMPLATES,
  MAINTENANCE_TICKET_BOARD_STATUSES,
  maintenanceTicketPushCopy,
  parseRoutineImageUrlsFromForm,
  ticketBoardStatus,
} from '@veka/shared';
import type { MaintenanceRecurrence } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import { deliverUnitPushNotification } from '@/lib/unit-push';

export async function updateTicketStatus(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const ticketId = String(formData.get('ticket_id') ?? '');
  const rawStatus = String(formData.get('status') ?? '') as MaintenanceTicketStatus;
  const adminNotes = String(formData.get('admin_notes') ?? '').trim();

  if (!ticketId) return { error: 'Ticket inválido.' };
  if (!(MAINTENANCE_TICKET_BOARD_STATUSES as readonly string[]).includes(rawStatus) && rawStatus !== 'closed') {
    return { error: 'Estado inválido.' };
  }

  const status = ticketBoardStatus(rawStatus);

  const { data: ticket } = await supabase
    .from('maintenance_tickets')
    .select('id, status, title, unit_id')
    .eq('id', ticketId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!ticket) return { error: 'Ticket no encontrado.' };

  const { error } = await supabase
    .from('maintenance_tickets')
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    })
    .eq('id', ticketId)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };

  if (ticket.status !== status && ticket.unit_id) {
    const copy = maintenanceTicketPushCopy(status, ticket.title);
    await deliverUnitPushNotification({
      unitId: ticket.unit_id,
      title: copy.title,
      body: copy.body,
      data: { screen: 'maintenance', ticketId, ticket_id: ticketId },
    });
  }

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function createMaintenanceSchedule(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const amenityId = String(formData.get('amenity_id') ?? '').trim();
  const periodStart = String(formData.get('period_start') ?? '').trim();
  const periodEnd = String(formData.get('period_end') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();
  const fileName = String(formData.get('file_name') ?? '').trim();

  if (!title) return { error: 'Título obligatorio.' };
  if (!fileUrl) return { error: 'Sube el calendario o documento.' };

  const { error } = await supabase.from('maintenance_schedules').insert({
    condominium_id: condominiumId,
    amenity_id: amenityId || null,
    title,
    description: description || null,
    period_start: periodStart || null,
    period_end: periodEnd || null,
    file_url: fileUrl,
    file_name: fileName || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function createWorkLog(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const amenityId = String(formData.get('amenity_id') ?? '').trim();
  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const workDate = String(formData.get('work_date') ?? '');
  const photoUrl = String(formData.get('photo_url') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();
  const fileName = String(formData.get('file_name') ?? '').trim();

  if (!title) return { error: 'Título obligatorio.' };
  if (!workDate) return { error: 'Fecha obligatoria.' };
  if (!photoUrl && !fileUrl) return { error: 'Adjunta al menos una foto o documento.' };

  const { error } = await supabase.from('maintenance_work_logs').insert({
    condominium_id: condominiumId,
    amenity_id: amenityId || null,
    ticket_id: ticketId || null,
    title,
    description: description || null,
    work_date: workDate,
    photo_url: photoUrl || null,
    file_url: fileUrl || null,
    file_name: fileName || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function createMaintenanceRoutine(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const amenityId = String(formData.get('amenity_id') ?? '').trim();
  const recurrence = String(formData.get('recurrence') ?? 'weekly') as MaintenanceRecurrence;
  const dayRaw = String(formData.get('day_of_week') ?? '').trim();
  const monthlyDayRaw = String(formData.get('monthly_day') ?? '').trim();
  const anchorDate = String(formData.get('anchor_date') ?? '').trim();

  if (!title) return { error: 'Título obligatorio.' };
  if (!MAINTENANCE_RECURRENCES.includes(recurrence)) return { error: 'Recurrencia inválida.' };

  let dayOfWeek: number | null = dayRaw ? Number(dayRaw) : null;
  if (recurrence === 'on_demand') {
    dayOfWeek = null;
  } else if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) {
    return { error: 'Selecciona el día de la semana.' };
  }

  let monthlyDay: number | null = null;
  if (recurrence === 'monthly') {
    monthlyDay = monthlyDayRaw ? Number(monthlyDayRaw) : null;
    if (!monthlyDay || monthlyDay < 1 || monthlyDay > 31) {
      return { error: 'Indica el día del mes (1-31) para actividades mensuales.' };
    }
  }

  const { data: routine, error } = await supabase
    .from('maintenance_routines')
    .insert({
      condominium_id: condominiumId,
      amenity_id: amenityId || null,
      title,
      description: description || null,
      day_of_week: dayOfWeek,
      recurrence,
      monthly_day: monthlyDay,
      anchor_date: recurrence === 'biweekly' && anchorDate ? anchorDate : null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !routine) return { error: error?.message ?? 'No se pudo crear la actividad.' };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function createMaintenanceRoutinesFromTemplates(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const selectedIds = [...new Set(formData.getAll('template_id').map((value) => String(value).trim()).filter(Boolean))];
  if (selectedIds.length === 0) return { error: 'Selecciona al menos una plantilla.' };

  const templates = MAINTENANCE_ROUTINE_TEMPLATES.filter((template) => selectedIds.includes(template.id));
  if (templates.length === 0) return { error: 'Plantillas inválidas.' };

  const { data: existing } = await supabase
    .from('maintenance_routines')
    .select('title')
    .eq('condominium_id', condominiumId)
    .eq('is_active', true);

  const existingTitles = new Set((existing ?? []).map((row) => String(row.title).trim().toLowerCase()));
  const toInsert = templates.filter((template) => !existingTitles.has(template.title.toLowerCase()));

  if (toInsert.length === 0) {
    return { error: 'Esas plantillas ya están en el calendario.' };
  }

  const { data: lastRoutine } = await supabase
    .from('maintenance_routines')
    .select('sort_order')
    .eq('condominium_id', condominiumId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder = (lastRoutine?.sort_order ?? 0) + 1;
  const { error } = await supabase.from('maintenance_routines').insert(
    toInsert.map((template) => ({
      condominium_id: condominiumId,
      amenity_id: null,
      title: template.title,
      description: template.description,
      day_of_week: template.day_of_week,
      recurrence: template.recurrence,
      monthly_day: template.monthly_day,
      sort_order: sortOrder++,
      created_by: user.id,
    })),
  );

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true, created: toInsert.length };
}

export async function createMaintenanceRoutineEvidence(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const routineId = String(formData.get('routine_id') ?? '').trim();
  const evidenceDate = String(formData.get('evidence_date') ?? '').trim();
  const imageUrls = parseRoutineImageUrlsFromForm(formData);

  if (!routineId) return { error: 'Selecciona la actividad.' };
  if (!evidenceDate) return { error: 'Indica la fecha del trabajo.' };
  if (imageUrls.length === 0) return { error: 'Sube al menos una foto de evidencia.' };

  const { data: routine } = await supabase
    .from('maintenance_routines')
    .select('id')
    .eq('id', routineId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!routine) return { error: 'Actividad no encontrada.' };

  const { error } = await supabase.from('maintenance_routine_evidence').insert(
    imageUrls.map((imageUrl, index) => ({
      routine_id: routineId,
      evidence_date: evidenceDate,
      image_url: imageUrl,
      sort_order: index,
      created_by: user.id,
    })),
  );

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function deleteMaintenanceRoutine(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const routineId = String(formData.get('routine_id') ?? '').trim();
  if (!routineId) return { error: 'Actividad inválida.' };

  const { error } = await supabase
    .from('maintenance_routines')
    .delete()
    .eq('id', routineId)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function addTicketAttachment(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();
  const fileName = String(formData.get('file_name') ?? '').trim();

  if (!ticketId) return { error: 'Ticket inválido.' };
  if (!fileUrl) return { error: 'Sube una imagen o PDF.' };

  const { data: ticket } = await supabase
    .from('maintenance_tickets')
    .select('id')
    .eq('id', ticketId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!ticket) return { error: 'Ticket no encontrado.' };

  const { count } = await supabase
    .from('maintenance_ticket_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId);

  const { error } = await supabase.from('maintenance_ticket_attachments').insert({
    ticket_id: ticketId,
    file_url: fileUrl,
    file_name: fileName || null,
    sort_order: count ?? 0,
    uploaded_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}

export async function deleteTicketAttachment(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const attachmentId = String(formData.get('attachment_id') ?? '').trim();
  if (!attachmentId) return { error: 'Adjunto inválido.' };

  const { data: attachment } = await supabase
    .from('maintenance_ticket_attachments')
    .select('id, ticket:maintenance_tickets!inner(condominium_id)')
    .eq('id', attachmentId)
    .maybeSingle();

  const ticket = attachment?.ticket as { condominium_id: string } | { condominium_id: string }[] | null;
  const condoFromTicket = Array.isArray(ticket) ? ticket[0]?.condominium_id : ticket?.condominium_id;
  if (!attachment || condoFromTicket !== condominiumId) {
    return { error: 'Adjunto no encontrado.' };
  }

  const { error } = await supabase.from('maintenance_ticket_attachments').delete().eq('id', attachmentId);
  if (error) return { error: error.message };

  revalidatePath('/mantenimiento');
  return { success: true };
}
