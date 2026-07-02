'use server';

import { revalidatePath } from 'next/cache';

import { isStaffRole, TEAM_STAFF_ROLES, type MembershipRole } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { sendInvitationEmail } from '@/lib/invitation-email';
import { createClient } from '@/lib/supabase/server';

const STAFF_ASSIGNABLE: MembershipRole[] = ['admin', 'board_member', 'guard', 'staff'];

const ROLE_LABELS: Record<MembershipRole, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export async function updateMemberRole(membershipId: string, role: MembershipRole) {
  if (!STAFF_ASSIGNABLE.includes(role)) {
    return { error: 'Rol no permitido para equipo operativo.' };
  }

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

  revalidatePath('/configuracion/equipo');
  return { success: true };
}

export async function inviteStaffMember(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

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
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['admin', 'super_admin'].includes(membership.role as string)) {
    return { error: 'Sin permisos de administrador' };
  }

  const { data: condo } = await supabase
    .from('condominiums')
    .select('name')
    .eq('id', condominiumId)
    .maybeSingle();

  const { error } = await supabase.from('invitations').insert({
    email,
    condominium_id: condominiumId,
    unit_id: null,
    role,
    unit_relationship: null,
    invited_by: user.id,
  });

  if (error) return { error: error.message };

  await sendInvitationEmail({
    to: email,
    condominiumName: condo?.name ?? 'tu condominio',
    roleLabel: ROLE_LABELS[role] ?? role,
  });

  revalidatePath('/configuracion/equipo');
  return { success: true };
}
