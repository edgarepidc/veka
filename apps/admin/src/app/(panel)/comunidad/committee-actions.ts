'use server';

import { revalidatePath } from 'next/cache';
import { COMMITTEE_KINDS, type CommitteeKind } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export async function addCommitteeMember(formData: FormData) {
  const condoResult = await requireActiveCondominiumId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const membershipId = String(formData.get('membership_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const committeeKind = String(formData.get('committee_kind') ?? 'vigilance') as CommitteeKind;

  if (!membershipId) return { error: 'Selecciona un residente del directorio.' };
  if (!title) return { error: 'Indica el cargo en el comité.' };
  if (!COMMITTEE_KINDS.includes(committeeKind)) return { error: 'Comité inválido.' };

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, condominium_id, unit_id, status')
    .eq('id', membershipId)
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return { error: 'La persona no pertenece a este condominio.' };
  if (!membership.unit_id) {
    return { error: 'El comité de vigilancia se integra con residentes (con vivienda).' };
  }

  const { error } = await supabase.from('condo_committee_members').upsert(
    {
      condominium_id: condominiumId,
      membership_id: membershipId,
      committee_kind: committeeKind,
      title,
    },
    { onConflict: 'condominium_id,membership_id,committee_kind' },
  );

  if (error) return { error: error.message };
  revalidatePath('/comunidad');
  return { success: true };
}

export async function removeCommitteeMember(memberId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const id = memberId.trim();
  if (!id) return { error: 'Integrante no válido.' };

  const { error } = await supabase
    .from('condo_committee_members')
    .delete()
    .eq('id', id)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };
  revalidatePath('/comunidad');
  return { success: true };
}
