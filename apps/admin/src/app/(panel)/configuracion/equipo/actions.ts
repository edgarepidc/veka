'use server';

import { revalidatePath } from 'next/cache';

import { type MembershipRole } from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

const ASSIGNABLE_ROLES: MembershipRole[] = ['admin', 'board_member', 'resident', 'guard', 'staff'];

export async function updateMemberRole(membershipId: string, role: MembershipRole) {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { error: 'Rol no permitido.' };
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

  if (target.user_id === user.id && role !== 'admin' && target.role === 'admin') {
    return { error: 'No puedes quitarte el rol de administrador a ti mismo.' };
  }

  const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId);

  if (error) return { error: error.message };

  revalidatePath('/configuracion/equipo');
  return { success: true };
}
