'use server';

import { revalidatePath } from 'next/cache';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

function revalidateUnits() {
  revalidatePath('/configuracion/unidades');
  revalidatePath('/configuracion/invitaciones');
}

export async function createCluster(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Nombre requerido.' };

  const { error } = await supabase.from('clusters').insert({
    condominium_id: DEMO_CONDO_ID,
    name,
  });

  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function deleteCluster(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID inválido.' };

  const { error } = await supabase.from('clusters').delete().eq('id', id).eq('condominium_id', DEMO_CONDO_ID);
  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function createUnit(formData: FormData) {
  const supabase = await createClient();
  const identifier = String(formData.get('identifier') ?? '').trim();
  const clusterId = String(formData.get('cluster_id') ?? '') || null;
  const coefficient = Number(formData.get('coefficient') ?? 1);

  if (!identifier) return { error: 'Identificador requerido.' };
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return { error: 'Coeficiente inválido.' };
  }

  const { error } = await supabase.from('units').insert({
    condominium_id: DEMO_CONDO_ID,
    cluster_id: clusterId,
    identifier,
    coefficient,
  });

  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}

export async function deleteUnit(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'ID inválido.' };

  const { error } = await supabase.from('units').delete().eq('id', id).eq('condominium_id', DEMO_CONDO_ID);
  if (error) return { error: error.message };
  revalidateUnits();
  return { success: true };
}
