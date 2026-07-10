'use server';

import { revalidatePath } from 'next/cache';
import { STAFF_SECTIONS, VIGILANCE_TITLE_OPTIONS } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

const STAFF_SECTION_IDS = new Set(STAFF_SECTIONS.map((section) => section.id));

export async function addManualStaffEntry(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const staffSectionId = String(formData.get('staff_section_id') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const unitIdentifier = String(formData.get('unit_identifier') ?? '').trim();
  const roleLabel = String(formData.get('role_label') ?? '').trim();
  const showPhone = formData.get('show_phone') === 'on';

  if (!STAFF_SECTION_IDS.has(staffSectionId)) return { error: 'Área de equipo inválida.' };
  if (!fullName) return { error: 'Indica el nombre completo.' };

  const { error } = await supabase.from('directory_manual_entries').insert({
    condominium_id: condominiumId,
    entry_kind: 'staff',
    staff_section_id: staffSectionId,
    full_name: fullName,
    phone: phone || null,
    unit_identifier: unitIdentifier || null,
    role_label: roleLabel || null,
    show_phone: showPhone,
  });

  if (error) return { error: error.message };
  revalidatePath('/configuracion/equipo');
  revalidatePath('/comunidad');
  return { success: true };
}

export async function addManualCommitteeEntry(formData: FormData) {
  const condoResult = await requireActiveCondominiumId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const fullName = String(formData.get('full_name') ?? '').trim();
  const title = String(formData.get('committee_title') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const unitIdentifier = String(formData.get('unit_identifier') ?? '').trim();
  const showPhone = formData.get('show_phone') === 'on';

  if (!fullName) return { error: 'Indica el nombre completo.' };
  if (!title) return { error: 'Indica el cargo en el comité.' };
  if (!VIGILANCE_TITLE_OPTIONS.includes(title as (typeof VIGILANCE_TITLE_OPTIONS)[number])) {
    return { error: 'Cargo de comité inválido.' };
  }

  const { error } = await supabase.from('directory_manual_entries').insert({
    condominium_id: condominiumId,
    entry_kind: 'committee',
    committee_title: title,
    full_name: fullName,
    phone: phone || null,
    unit_identifier: unitIdentifier || null,
    show_phone: showPhone,
  });

  if (error) return { error: error.message };
  revalidatePath('/comunidad');
  return { success: true };
}

export async function removeManualDirectoryEntry(entryId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const id = entryId.trim();
  if (!id) return { error: 'Registro no válido.' };

  const { error } = await supabase
    .from('directory_manual_entries')
    .delete()
    .eq('id', id)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };
  revalidatePath('/configuracion/equipo');
  revalidatePath('/comunidad');
  return { success: true };
}
