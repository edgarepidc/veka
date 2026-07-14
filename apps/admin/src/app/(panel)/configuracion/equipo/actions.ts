'use server';

import { revalidatePath } from 'next/cache';

import { isStaffRole, STAFF_SECTIONS, type MembershipRole } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { parsePersonFields, provisionUserWithMembership } from '@/lib/provision-user';
import { assertAdminAction } from '@/lib/require-admin';
import { createClient } from '@/lib/supabase/server';

const STAFF_ASSIGNABLE: MembershipRole[] = ['admin', 'guard', 'staff'];
const CONFIG_TEAM_ROLES = STAFF_SECTIONS.flatMap((section) => section.roles);

function revalidateTeam() {
  revalidatePath('/configuracion');
  revalidatePath('/configuracion/equipo');
  revalidatePath('/comunidad');
}

export async function updateMemberRole(membershipId: string, role: MembershipRole) {
  if (!STAFF_ASSIGNABLE.includes(role)) {
    return { error: 'Rol no permitido para equipo operativo.' };
  }

  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { data: target } = await supabase
    .from('memberships')
    .select('id, user_id, role, condominium_id')
    .eq('id', membershipId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!target) return { error: 'Miembro no encontrado.' };
  if (target.role === 'super_admin') {
    return { error: 'No se puede modificar un super admin.' };
  }
  if (!isStaffRole(target.role as MembershipRole)) {
    return { error: 'Solo se gestionan roles de staff desde esta sección.' };
  }

  if (target.user_id === user.id && role !== 'admin' && target.role === 'admin') {
    return { error: 'No puedes quitarte el rol de administrador a ti mismo.' };
  }

  const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId);

  if (error) return { error: error.message };

  revalidateTeam();
  return { success: true };
}

export async function setStaffPhoneVisibility(membershipId: string, showPhone: boolean) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const id = membershipId.trim();
  if (!id) return { error: 'Miembro no válido.' };

  const { data: target } = await supabase
    .from('memberships')
    .select('id, role, condominium_id')
    .eq('id', id)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!target) return { error: 'Miembro no encontrado.' };
  if (!CONFIG_TEAM_ROLES.includes(target.role as MembershipRole)) {
    return { error: 'Solo se controla el teléfono de roles de app.' };
  }

  const { error } = await supabase
    .from('memberships')
    .update({ show_phone_in_directory: showPhone })
    .eq('id', id)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };

  revalidateTeam();
  return { success: true };
}

export async function registerStaffMember(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const role = String(formData.get('role') ?? '') as MembershipRole;
  if (!CONFIG_TEAM_ROLES.includes(role) || role === 'super_admin') {
    return { error: 'Rol de staff inválido.' };
  }

  const person = parsePersonFields(formData);
  if ('empty' in person) {
    return { error: 'Nombre, correo y contraseña son obligatorios.' };
  }
  if ('error' in person) return { error: person.error };

  const showPhoneInDirectory = formData.get('show_phone_in_directory') === 'true';

  const result = await provisionUserWithMembership(person, {
    condominiumId,
    role,
    unitId: null,
    unitRelationship: null,
    showPhoneInDirectory,
  });

  if ('error' in result) return { error: result.error };

  revalidateTeam();
  return { success: true };
}
