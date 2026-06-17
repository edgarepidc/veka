'use server';

import { revalidatePath } from 'next/cache';

import { isStaffRole, TEAM_STAFF_ROLES, type MembershipRole } from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

const STAFF_ASSIGNABLE: MembershipRole[] = ['admin', 'board_member', 'guard', 'staff'];

export async function updateMemberRole(membershipId: string, role: MembershipRole) {
  if (!STAFF_ASSIGNABLE.includes(role)) {
    return { error: 'Rol no permitido para equipo operativo.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { data: target } = await supabase
    .from('memberships')
    .select('id, user_id, role, condominium_id')
    .eq('id', membershipId)
    .eq('condominium_id', DEMO_CONDO_ID)
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

  revalidatePath('/configuracion/equipo');
  return { success: true };
}

export async function inviteStaffMember(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '') as MembershipRole;

  if (!email) return { error: 'Correo obligatorio.' };
  if (!TEAM_STAFF_ROLES.includes(role) || role === 'super_admin') {
    return { error: 'Rol de staff inválido.' };
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('condominium_id', DEMO_CONDO_ID)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['admin', 'super_admin'].includes(membership.role as string)) {
    return { error: 'Sin permisos de administrador' };
  }

  const { error } = await supabase.from('invitations').insert({
    email,
    condominium_id: DEMO_CONDO_ID,
    unit_id: null,
    role,
    unit_relationship: null,
    invited_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/configuracion/equipo');
  return { success: true };
}
