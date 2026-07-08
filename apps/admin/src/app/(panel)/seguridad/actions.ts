'use server';

import { revalidatePath } from 'next/cache';

import { parseVisitQrPayload } from '@veka/shared';

import { deliverUnitPushNotification } from '@/lib/unit-push';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { assertAdminAction } from '@/lib/require-admin';
import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

export async function updateSecuritySettings(formData: FormData) {
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
    security: {
      ...current.security,
      block_rental_visits_if_overdue: checkbox(formData, 'block_rental_visits_if_overdue'),
    },
  };

  const { error } = await supabase
    .from('condominiums')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath('/seguridad');
  return { success: true };
}

export async function checkInVisit(input: { condominiumId: string; payload: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado.' };

  const parsed = parseVisitQrPayload(input.payload);
  if (!parsed) return { error: 'Código QR o referencia inválida.' };

  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      'id, visitor_name, visit_type, valid_from, valid_until, stay_days, vehicle_plate, vehicle_model, notes, checked_in_at, checked_out_at, unit:units (identifier)',
    )
    .eq('condominium_id', input.condominiumId)
    .eq('qr_token', parsed.token)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!visit) return { error: 'Visita no encontrada en este condominio.' };

  const unit = Array.isArray(visit.unit) ? visit.unit[0] : visit.unit;
  const unitIdentifier = unit?.identifier ?? '—';
  const now = Date.now();

  if (new Date(visit.valid_from).getTime() > now) {
    return { error: 'Este pase aún no es válido.' };
  }
  if (new Date(visit.valid_until).getTime() < now) {
    return { error: 'Este pase ya expiró.' };
  }
  if (visit.checked_out_at) {
    return { error: 'El visitante ya registró salida.' };
  }

  if (visit.checked_in_at) {
    return {
      ok: true,
      alreadyCheckedIn: true,
      visit: {
        visitorName: visit.visitor_name,
        visitType: visit.visit_type,
        unitIdentifier,
        validUntil: visit.valid_until,
      },
    };
  }

  const { error: updateError } = await supabase
    .from('visits')
    .update({
      checked_in_at: new Date().toISOString(),
      checked_in_by: user.id,
    })
    .eq('id', visit.id);

  if (updateError) return { error: updateError.message };

  revalidatePath('/seguridad');

  return {
    ok: true,
    alreadyCheckedIn: false,
    visit: {
      visitorName: visit.visitor_name,
      visitType: visit.visit_type,
      unitIdentifier,
      validUntil: visit.valid_until,
    },
  };
}

export async function registerPackage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado.' };

  const condominiumId = String(formData.get('condominium_id') ?? '').trim();
  const unitId = String(formData.get('unit_id') ?? '').trim();
  const carrier = String(formData.get('carrier') ?? '').trim();
  const trackingNumber = String(formData.get('tracking_number') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!condominiumId || !unitId) {
    return { error: 'Selecciona unidad y condominio.' };
  }

  const { data: pkg, error } = await supabase
    .from('packages')
    .insert({
      condominium_id: condominiumId,
      unit_id: unitId,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      notes: notes || null,
      received_by: user.id,
      status: 'received',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  const label = carrier || 'Paquete';
  const tracking = trackingNumber ? ` · Guía ${trackingNumber}` : '';

  await deliverUnitPushNotification({
    unitId,
    title: 'Paquete en caseta — Veka',
    body: `${label}${tracking}. Pasa por recepción cuando puedas.`,
    data: { screen: 'security', tab: 'paquetes', packageId: pkg.id },
  });

  revalidatePath('/seguridad');
  return { ok: true };
}

export async function deliverPackage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado.' };

  const packageId = String(formData.get('package_id') ?? '').trim();
  const deliveredTo = String(formData.get('delivered_to') ?? '').trim();

  if (!packageId) return { error: 'Paquete inválido.' };

  const { error } = await supabase
    .from('packages')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivered_to: deliveredTo || null,
    })
    .eq('id', packageId)
    .eq('status', 'received');

  if (error) return { error: error.message };

  revalidatePath('/seguridad');
  return { ok: true };
}

export async function checkOutVisit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado.' };

  const visitId = String(formData.get('visit_id') ?? '').trim();
  if (!visitId) return { error: 'Visita inválida.' };

  const { error } = await supabase
    .from('visits')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', visitId)
    .is('checked_out_at', null)
    .not('checked_in_at', 'is', null);

  if (error) return { error: error.message };

  revalidatePath('/seguridad');
  return { ok: true };
}
