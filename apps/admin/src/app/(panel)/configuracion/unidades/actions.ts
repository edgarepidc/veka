'use server';

import { revalidatePath } from 'next/cache';
import { buildUnitIdentifier, type UnitKind, type UnitRelationship } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { parsePersonFields, provisionUserWithMembership } from '@/lib/provision-user';
import { assertAdminAction } from '@/lib/require-admin';
import { createClient } from '@/lib/supabase/server';

function revalidateUnits() {
  revalidatePath('/configuracion');
  revalidatePath('/configuracion/unidades');
}

export async function createCluster(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

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
  const denied = await assertAdminAction();
  if (denied) return denied;

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
  const denied = await assertAdminAction();
  if (denied) return denied;

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

  const ownerParsed = parsePersonFields(formData, 'owner');
  if ('error' in ownerParsed) return { error: ownerParsed.error };
  const tenantParsed = parsePersonFields(formData, 'tenant');
  if ('error' in tenantParsed) return { error: tenantParsed.error };

  const { data: cluster } = await supabase
    .from('clusters')
    .select('name')
    .eq('id', clusterId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!cluster) return { error: 'Cluster no encontrado.' };

  const identifier = buildUnitIdentifier(cluster.name, unitKind, unitNumber);

  const { data: unit, error } = await supabase
    .from('units')
    .insert({
      condominium_id: condominiumId,
      cluster_id: clusterId,
      identifier,
      unit_kind: unitKind,
      unit_number: unitNumber,
      coefficient: 1,
    })
    .select('id')
    .single();

  if (error || !unit) return { error: error?.message ?? 'No se pudo crear la unidad.' };

  if (!('empty' in ownerParsed)) {
    const result = await provisionUserWithMembership(ownerParsed, {
      condominiumId,
      role: 'resident',
      unitId: unit.id,
      unitRelationship: 'owner',
    });
    if ('error' in result) {
      await supabase.from('units').delete().eq('id', unit.id);
      return { error: result.error };
    }
  }

  if (!('empty' in tenantParsed)) {
    const result = await provisionUserWithMembership(tenantParsed, {
      condominiumId,
      role: 'resident',
      unitId: unit.id,
      unitRelationship: 'tenant',
    });
    if ('error' in result) {
      return {
        error: `Unidad creada, pero el inquilino falló: ${result.error}`,
      };
    }
  }

  revalidateUnits();
  return { success: true };
}

export async function deleteUnit(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

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

export async function registerUnitOccupant(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const unitId = String(formData.get('unit_id') ?? '').trim();
  const relationship = String(formData.get('unit_relationship') ?? 'owner') as UnitRelationship;

  if (!unitId) return { error: 'Unidad requerida.' };
  if (relationship !== 'owner' && relationship !== 'tenant') {
    return { error: 'Rol de ocupación inválido.' };
  }

  const person = parsePersonFields(formData);
  if ('empty' in person) {
    return { error: 'Nombre, correo y contraseña son obligatorios.' };
  }
  if ('error' in person) return { error: person.error };

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from('units')
    .select('id')
    .eq('id', unitId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!unit) return { error: 'Unidad no encontrada.' };

  const result = await provisionUserWithMembership(person, {
    condominiumId,
    role: 'resident',
    unitId,
    unitRelationship: relationship,
  });

  if ('error' in result) return { error: result.error };

  revalidateUnits();
  return { success: true };
}
