'use server';

import { revalidatePath } from 'next/cache';
import type { MembershipRole } from '@veka/shared';

import { createCondominiumWithOrganization } from '@/lib/create-condominium';
import {
  DEFAULT_BRANDING,
  parseCondominiumSettings,
  type CondominiumSettings,
} from '@/lib/condominium-settings';
import { ensureAuthUserAndProfile, parsePersonFields, provisionUserWithMembership } from '@/lib/provision-user';
import { sendInvitationEmail } from '@/lib/invitation-email';
import { assertPlatformAdminAction } from '@/lib/require-platform-admin';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ASSIGNABLE_ROLES: MembershipRole[] = ['super_admin', 'admin', 'board_member', 'guard', 'staff'];

const ROLE_LABELS: Record<MembershipRole, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export async function platformUpdateCondominium(formData: FormData) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const condominiumId = String(formData.get('condominium_id') ?? '').trim();
  if (!condominiumId) return { error: 'Condominio inválido.' };

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const address = String(formData.get('address') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? 'America/Mexico_City');
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const primaryColor = String(formData.get('primary_color') ?? '').trim();
  const accentColor = String(formData.get('accent_color') ?? '').trim();

  if (!name || !slug) return { error: 'Nombre y slug son obligatorios.' };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('condominiums')
    .select('settings')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!existing) return { error: 'Condominio no encontrado.' };

  const currentSettings = parseCondominiumSettings(existing.settings);
  const settings: CondominiumSettings = {
    ...currentSettings,
    branding: {
      logo_url: logoUrl || undefined,
      primary_color: primaryColor || DEFAULT_BRANDING.primary_color,
      accent_color: accentColor || DEFAULT_BRANDING.accent_color,
    },
  };

  const { error } = await admin
    .from('condominiums')
    .update({
      name,
      slug,
      address: address || null,
      timezone,
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath(`/platform/condominios/${condominiumId}`);
  revalidatePath('/platform/condominios');
  return { success: true };
}

export async function platformCreateCondominium(formData: FormData) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const admin = createAdminClient();
  const result = await createCondominiumWithOrganization(admin, {
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    timezone: String(formData.get('timezone') ?? 'America/Mexico_City'),
    organizationName: String(formData.get('organization_name') ?? ''),
  });

  if ('error' in result) return result;

  const adminRole = String(formData.get('admin_role') ?? 'super_admin') as MembershipRole;
  const person = parsePersonFields(formData, 'admin');
  if ('error' in person) return person;

  if (!('empty' in person)) {
    const assignResult = await provisionUserWithMembership(person, {
      condominiumId: result.condominiumId,
      role: ASSIGNABLE_ROLES.includes(adminRole) ? adminRole : 'super_admin',
    });
    if ('error' in assignResult) return assignResult;
  }

  revalidatePath('/platform');
  revalidatePath('/platform/condominios');
  return { success: true, condominiumId: result.condominiumId };
}

export async function platformAssignMembership(formData: FormData) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const condominiumId = String(formData.get('condominium_id') ?? '').trim();
  const role = String(formData.get('role') ?? 'admin') as MembershipRole;

  if (!condominiumId) return { error: 'Condominio inválido.' };
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: 'Rol no permitido.' };

  const person = parsePersonFields(formData);
  if ('error' in person) return person;
  if ('empty' in person) return { error: 'Nombre, correo y contraseña son obligatorios.' };

  const admin = createAdminClient();
  const { data: condo } = await admin
    .from('condominiums')
    .select('id')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return { error: 'Condominio no encontrado.' };

  const provisioned = await provisionUserWithMembership(person, {
    condominiumId,
    role,
  });
  if ('error' in provisioned) return provisioned;

  revalidatePath(`/platform/condominios/${condominiumId}`);
  revalidatePath(`/platform/condominios/${condominiumId}/equipo`);
  revalidatePath('/platform/condominios');
  return { success: true };
}

export async function platformRevokeMembership(membershipId: string, condominiumId: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  if (!membershipId) return { error: 'Membresía inválida.' };

  const admin = createAdminClient();
  const { error } = await admin.from('memberships').update({ status: 'inactive' }).eq('id', membershipId);

  if (error) return { error: error.message };

  revalidatePath(`/platform/condominios/${condominiumId}`);
  return { success: true };
}

export async function platformSetCondominiumStatus(condominiumId: string, status: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const allowed = ['active', 'suspended', 'archived'];
  if (!allowed.includes(status)) return { error: 'Estado inválido.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('condominiums')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', condominiumId);

  if (error) return { error: error.message };

  revalidatePath(`/platform/condominios/${condominiumId}`);
  revalidatePath('/platform/condominios');
  return { success: true };
}

export async function platformResendInvitation(invitationId: string, condominiumId: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, email, role, status, unit:units(identifier)')
    .eq('id', invitationId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!invitation) return { error: 'Invitación no encontrada.' };
  if (invitation.status !== 'pending') return { error: 'Solo se pueden reenviar invitaciones pendientes.' };

  const { data: condo } = await admin
    .from('condominiums')
    .select('name')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return { error: 'Condominio no encontrado.' };

  const unit = Array.isArray(invitation.unit) ? invitation.unit[0] : invitation.unit;
  const role = invitation.role as MembershipRole;

  const sent = await sendInvitationEmail({
    to: invitation.email,
    condominiumName: condo.name,
    roleLabel: ROLE_LABELS[role],
    unitLabel: unit?.identifier ?? null,
  });

  revalidatePath(`/platform/condominios/${condominiumId}/invitaciones`);
  return sent ? { success: true } : { error: 'No se pudo enviar el correo. Revisa RESEND_API_KEY.' };
}

export async function platformRevokeInvitation(invitationId: string, condominiumId: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const admin = createAdminClient();
  const { error } = await admin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('condominium_id', condominiumId)
    .eq('status', 'pending');

  if (error) return { error: error.message };

  revalidatePath(`/platform/condominios/${condominiumId}/invitaciones`);
  revalidatePath(`/platform/condominios/${condominiumId}/equipo`);
  return { success: true };
}

export async function platformAddPlatformAdmin(formData: FormData) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const notes = String(formData.get('notes') ?? '').trim();
  const person = parsePersonFields(formData);
  if ('error' in person) return person;
  if ('empty' in person) return { error: 'Nombre, correo y contraseña son obligatorios.' };

  const ensured = await ensureAuthUserAndProfile(person);
  if ('error' in ensured) return ensured;

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_admins')
    .upsert({ user_id: ensured.userId, notes: notes || null }, { onConflict: 'user_id' });

  if (error) return { error: error.message };

  revalidatePath('/platform/admins');
  return { success: true };
}

export async function platformRemovePlatformAdmin(userId: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  if (!userId) return { error: 'Usuario inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { count } = await admin.from('platform_admins').select('user_id', { count: 'exact', head: true });

  if ((count ?? 0) <= 1) return { error: 'Debe quedar al menos un administrador de plataforma.' };
  if (user?.id === userId) return { error: 'No puedes quitarte a ti mismo.' };

  const { error } = await admin.from('platform_admins').delete().eq('user_id', userId);
  if (error) return { error: error.message };

  revalidatePath('/platform/admins');
  return { success: true };
}
