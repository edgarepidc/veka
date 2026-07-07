'use server';

import { revalidatePath } from 'next/cache';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

function parseTime(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function upsertAmenity(formData: FormData) {
  const condoResult = await requireActiveCondominiumId(formData.get('condominium_id')?.toString());
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const amenityId = String(formData.get('amenity_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const openTime = parseTime(String(formData.get('open_time') ?? ''));
  const closeTime = parseTime(String(formData.get('close_time') ?? ''));

  if (!name) return { error: 'El nombre es obligatorio.' };
  if (!openTime || !closeTime) return { error: 'Horario inválido.' };
  if (openTime >= closeTime) return { error: 'La hora de cierre debe ser posterior a la de apertura.' };

  const payload = {
    condominium_id: condominiumId,
    name,
    description: description || null,
    open_time: openTime,
    close_time: closeTime,
    slot_duration_minutes: parsePositiveInt(String(formData.get('slot_duration_minutes') ?? ''), 60),
    max_daily_reservations: parsePositiveInt(String(formData.get('max_daily_reservations') ?? ''), 1),
    max_monthly_reservations: parsePositiveInt(String(formData.get('max_monthly_reservations') ?? ''), 4),
    is_active: formData.get('is_active') === 'on' || formData.get('is_active') === 'true',
  };

  const { error } = amenityId
    ? await supabase.from('amenities').update(payload).eq('id', amenityId).eq('condominium_id', condominiumId)
    : await supabase.from('amenities').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/espacios');
  return { success: true };
}

export async function toggleAmenityActive(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const amenityId = String(formData.get('amenity_id') ?? '').trim();
  const isActive = formData.get('is_active') === 'true';

  if (!amenityId) return { error: 'Amenidad inválida.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('amenities')
    .update({ is_active: isActive })
    .eq('id', amenityId)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath('/espacios');
  return { success: true };
}

export async function cancelReservation(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const reservationId = String(formData.get('reservation_id') ?? '').trim();
  if (!reservationId) return { error: 'Reserva inválida.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
    .eq('condominium_id', condominiumId)
    .eq('status', 'confirmed');

  if (error) return { error: error.message };

  revalidatePath('/espacios');
  return { success: true };
}
