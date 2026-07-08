'use server';

import { revalidatePath } from 'next/cache';
import type { MaintenanceTicketStatus } from '@veka/shared';
import { MAINTENANCE_TICKET_STATUSES, ticketStatusLabel } from '@veka/shared';

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
  const status = String(formData.get('status') ?? '') as MaintenanceTicketStatus;
  const adminNotes = String(formData.get('admin_notes') ?? '').trim();

  if (!ticketId) return { error: 'Ticket inválido.' };
  if (!MAINTENANCE_TICKET_STATUSES.includes(status)) return { error: 'Estado inválido.' };

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
      resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', ticketId)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };

  if (ticket.status !== status && ticket.unit_id) {
    await deliverUnitPushNotification({
      unitId: ticket.unit_id,
      title: 'Actualización de mantenimiento — Veka',
      body: `Tu reporte «${ticket.title}» ahora está: ${ticketStatusLabel(status)}.`,
      data: { screen: 'maintenance', ticketId },
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
