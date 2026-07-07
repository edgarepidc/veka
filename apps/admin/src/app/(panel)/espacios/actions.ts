'use server';

import { parseSpacesSettings } from '@veka/shared';
import {
  DEFAULT_MIN_BOOKING_LEAD_HOURS,
  DEFAULT_MIN_CANCEL_LEAD_HOURS,
  normalizeBookingHorizonDays,
  normalizeLeadHours,
  normalizeMaxActiveReservations,
  parseBlockedDatesInput,
} from '@veka/shared';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { deliverReservationUpdate } from '@/lib/notifications';
import { assertAdminAction } from '@/lib/require-admin';
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

function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

async function notifyReservationUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  condominiumId: string,
  reservationId: string,
  kind: 'approved' | 'cancelled',
) {
  const { data: condo } = await supabase
    .from('condominiums')
    .select('settings')
    .eq('id', condominiumId)
    .maybeSingle();

  const spacesSettings = parseSpacesSettings(condo?.settings);
  if (!spacesSettings.notify_reservation_updates) return;

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, user_id, unit_id, starts_at, amenity:amenities(name)')
    .eq('id', reservationId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!reservation?.user_id || !reservation.unit_id) return;

  const amenity = reservation.amenity as { name: string } | { name: string }[] | null;
  const amenityName = Array.isArray(amenity)
    ? (amenity[0]?.name ?? 'Espacio')
    : (amenity?.name ?? 'Espacio');

  await deliverReservationUpdate({
    condominiumId,
    unitId: reservation.unit_id,
    userId: reservation.user_id,
    reservationId: reservation.id,
    amenityName,
    startsAt: reservation.starts_at,
    kind,
  });
}

export async function updateSpacesSettings(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId(formData.get('condominium_id')?.toString());
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('condominiums')
    .select('settings')
    .eq('id', condominiumId)
    .maybeSingle();

  const current = parseCondominiumSettings(existing?.settings);
  const settings = {
    ...current,
    spaces: {
      ...current.spaces,
      block_reservations_if_overdue: checkbox(formData, 'block_reservations_if_overdue'),
      notify_reservation_updates: checkbox(formData, 'notify_reservation_updates'),
    },
  };

  const { error } = await supabase
    .from('condominiums')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath('/espacios');
  return { success: true };
}

export async function upsertAmenity(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId(formData.get('condominium_id')?.toString());
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const amenityId = String(formData.get('amenity_id') ?? '').trim() || randomUUID();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const openTime = parseTime(String(formData.get('open_time') ?? ''));
  const closeTime = parseTime(String(formData.get('close_time') ?? ''));
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const imageUrl = String(formData.get('image_url') ?? '').trim();
  const blockedDatesRaw = String(formData.get('blocked_dates') ?? '');

  if (!name) return { error: 'El nombre es obligatorio.' };
  if (!openTime || !closeTime) return { error: 'Horario inválido.' };
  if (openTime >= closeTime) return { error: 'La hora de cierre debe ser posterior a la de apertura.' };

  const payload = {
    condominium_id: condominiumId,
    name,
    description: description || null,
    cluster_id: clusterId || null,
    image_url: imageUrl || null,
    open_time: openTime,
    close_time: closeTime,
    slot_duration_minutes: parsePositiveInt(String(formData.get('slot_duration_minutes') ?? ''), 60),
    max_daily_reservations: parsePositiveInt(String(formData.get('max_daily_reservations') ?? ''), 1),
    max_monthly_reservations: parsePositiveInt(String(formData.get('max_monthly_reservations') ?? ''), 4),
    max_concurrent_reservations: parsePositiveInt(
      String(formData.get('max_concurrent_reservations') ?? ''),
      1,
    ),
    booking_horizon_days: normalizeBookingHorizonDays(formData.get('booking_horizon_days')),
    min_booking_lead_hours: normalizeLeadHours(
      formData.get('min_booking_lead_hours'),
      DEFAULT_MIN_BOOKING_LEAD_HOURS,
    ),
    min_cancel_lead_hours: normalizeLeadHours(
      formData.get('min_cancel_lead_hours'),
      DEFAULT_MIN_CANCEL_LEAD_HOURS,
    ),
    max_active_reservations: normalizeMaxActiveReservations(
      formData.get('max_active_reservations'),
    ),
    blocked_dates: parseBlockedDatesInput(blockedDatesRaw),
    requires_approval: checkbox(formData, 'requires_approval'),
    restrict_if_overdue: checkbox(formData, 'restrict_if_overdue'),
    is_active: checkbox(formData, 'is_active'),
  };

  const existingId = String(formData.get('amenity_id') ?? '').trim();
  const { error } = existingId
    ? await supabase.from('amenities').update(payload).eq('id', existingId).eq('condominium_id', condominiumId)
    : await supabase.from('amenities').insert({ ...payload, id: amenityId });

  if (error) return { error: error.message };

  revalidatePath('/espacios');
  return { success: true };
}

export async function toggleAmenityActive(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

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
  const denied = await assertAdminAction();
  if (denied) return denied;

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
    .in('status', ['confirmed', 'pending']);

  if (error) return { error: error.message };

  await notifyReservationUpdate(supabase, condominiumId, reservationId, 'cancelled');

  revalidatePath('/espacios');
  return { success: true };
}

export async function approveReservation(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const reservationId = String(formData.get('reservation_id') ?? '').trim();
  if (!reservationId) return { error: 'Reserva inválida.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmed' })
    .eq('id', reservationId)
    .eq('condominium_id', condominiumId)
    .eq('status', 'pending');

  if (error) return { error: error.message };

  await notifyReservationUpdate(supabase, condominiumId, reservationId, 'approved');

  revalidatePath('/espacios');
  return { success: true };
}
