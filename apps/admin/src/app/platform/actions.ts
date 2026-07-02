'use server';

import { revalidatePath } from 'next/cache';
import type { MembershipRole } from '@veka/shared';

import { createCondominiumWithOrganization } from '@/lib/create-condominium';
import {
  DEFAULT_BRANDING,
  parseCondominiumSettings,
  type CondominiumSettings,
} from '@/lib/condominium-settings';
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

async function findUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await admin.rpc('get_user_id_by_email', { p_email: email });
  if (error) return null;
  return (data as string | null) ?? null;
}

async function upsertStaffMembership(
  admin: ReturnType<typeof createAdminClient>,
  input: { userId: string; condominiumId: string; role: MembershipRole },
) {
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', input.userId)
    .eq('condominium_id', input.condominiumId)
    .is('unit_id', null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('memberships')
      .update({ role: input.role, status: 'active' })
      .eq('id', existing.id);
    return error;
  }

  const { error } = await admin.from('memberships').insert({
    user_id: input.userId,
    condominium_id: input.condominiumId,
    role: input.role,
    status: 'active',
    unit_id: null,
  });

  return error;
}

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

  const adminEmail = String(formData.get('admin_email') ?? '').trim().toLowerCase();
  const adminRole = String(formData.get('admin_role') ?? 'super_admin') as MembershipRole;

  if (adminEmail) {
    const assignResult = await platformAssignMembershipInternal(admin, {
      condominiumId: result.condominiumId,
      email: adminEmail,
      role: ASSIGNABLE_ROLES.includes(adminRole) ? adminRole : 'super_admin',
      condominiumName: result.condominiumName,
    });
    if ('error' in assignResult) return assignResult;
  }

  revalidatePath('/platform');
  revalidatePath('/platform/condominios');
  return { success: true, condominiumId: result.condominiumId };
}

async function platformAssignMembershipInternal(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    condominiumId: string;
    email: string;
    role: MembershipRole;
    condominiumName: string;
    invitedBy?: string | null;
  },
) {
  if (!input.email) return { error: 'Correo obligatorio.' };
  if (!ASSIGNABLE_ROLES.includes(input.role)) return { error: 'Rol no permitido.' };

  const userId = await findUserIdByEmail(admin, input.email);

  if (userId) {
    const error = await upsertStaffMembership(admin, {
      userId,
      condominiumId: input.condominiumId,
      role: input.role,
    });
    if (error) return { error: error.message };
    return { success: true, mode: 'membership' as const };
  }

  const { error: inviteError } = await admin.from('invitations').insert({
    email: input.email,
    condominium_id: input.condominiumId,
    unit_id: null,
    role: input.role,
    unit_relationship: null,
    invited_by: input.invitedBy ?? null,
  });

  if (inviteError) return { error: inviteError.message };

  await sendInvitationEmail({
    to: input.email,
    condominiumName: input.condominiumName,
    roleLabel: ROLE_LABELS[input.role],
  });

  return { success: true, mode: 'invitation' as const };
}

export async function platformAssignMembership(formData: FormData) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  const condominiumId = String(formData.get('condominium_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'admin') as MembershipRole;

  if (!condominiumId) return { error: 'Condominio inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: condo } = await admin
    .from('condominiums')
    .select('name')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return { error: 'Condominio no encontrado.' };

  const result = await platformAssignMembershipInternal(admin, {
    condominiumId,
    email,
    role,
    condominiumName: condo.name,
    invitedBy: user?.id ?? null,
  });

  revalidatePath(`/platform/condominios/${condominiumId}`);
  revalidatePath('/platform/condominios');
  return result;
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
