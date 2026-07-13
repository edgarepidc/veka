'use server';

import { revalidatePath } from 'next/cache';
import { buildUnitIdentifier, type UnitKind, type UnitRelationship } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { sendInvitationEmail } from '@/lib/invitation-email';
import { createClient } from '@/lib/supabase/server';

function revalidateUnits() {
  revalidatePath('/configuracion');
  revalidatePath('/configuracion/unidades');
  revalidatePath('/configuracion/invitaciones');
}

export async function createCluster(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nombre requerido.' };

  const { error } = await supabase.from('clusters').insert({
    condominium_id: condominiumId,
    name,
  });

  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function deleteCluster(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID inválido.' };

  const { error } = await supabase
    .from('clusters')
    .delete()
    .eq('id', id)
    .eq('condominium_id', condominiumId);
  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function createUnit(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const unitKind = String(formData.get('unit_kind') ?? '') as UnitKind;
  const unitNumber = String(formData.get('unit_number') ?? '').trim();

  if (!clusterId) return { error: 'Cluster requerido.' };
  if (unitKind !== 'casa' && unitKind !== 'depto') {
    return { error: 'Selecciona Casa o Depto.' };
  }
  if (!unitNumber) return { error: 'Número de unidad requerido.' };

  const { data: cluster } = await supabase
    .from('clusters')
    .select('name')
    .eq('id', clusterId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!cluster) return { error: 'Cluster no encontrado.' };

  const identifier = buildUnitIdentifier(cluster.name, unitKind, unitNumber);

  const { error } = await supabase.from('units').insert({
    condominium_id: condominiumId,
    cluster_id: clusterId,
    identifier,
    unit_kind: unitKind,
    unit_number: unitNumber,
    coefficient: 1,
  });

  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function deleteUnit(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID inválido.' };

  const { error } = await supabase.from('units').delete().eq('id', id).eq('condominium_id', condominiumId);
  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function inviteUnitOccupant(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const unitId = String(formData.get('unit_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const relationship = String(formData.get('unit_relationship') ?? 'owner') as UnitRelationship;

  if (!unitId || !email) {
    return { error: 'Unidad y correo son obligatorios.' };
  }

  if (relationship !== 'owner' && relationship !== 'tenant') {
    return { error: 'Rol de ocupación inválido.' };
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['admin', 'super_admin'].includes(membership.role as string)) {
    return { error: 'Sin permisos de administrador' };
  }

  const [{ data: condo }, { data: unit }] = await Promise.all([
    supabase.from('condominiums').select('name').eq('id', condominiumId).maybeSingle(),
    supabase.from('units').select('identifier').eq('id', unitId).maybeSingle(),
  ]);

  const { error } = await supabase.from('invitations').insert({
    email,
    condominium_id: condominiumId,
    unit_id: unitId,
    role: 'resident',
    unit_relationship: relationship,
    invited_by: user.id,
  });

  if (error) return { error: error.message };

  await sendInvitationEmail({
    to: email,
    condominiumName: condo?.name ?? 'tu condominio',
    unitLabel: unit?.identifier,
    roleLabel: relationship === 'tenant' ? 'inquilino' : 'propietario',
  });

  revalidateUnits();
  return { success: true };
}
