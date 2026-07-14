import type { MembershipRole, UnitRelationship } from '@veka/shared';

import { createAdminClient } from '@/lib/supabase/admin';

export type ProvisionPersonInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
};

export type ProvisionMembershipInput = {
  condominiumId: string;
  role: MembershipRole;
  unitId?: string | null;
  unitRelationship?: UnitRelationship | null;
  showPhoneInDirectory?: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parsePersonFields(
  formData: FormData,
  prefix = '',
): ProvisionPersonInput | { empty: true } | { error: string } {
  const p = prefix ? `${prefix}_` : '';
  const email = String(formData.get(`${p}email`) ?? '').trim();
  const password = String(formData.get(`${p}password`) ?? '');
  const fullName = String(formData.get(`${p}full_name`) ?? '').trim();
  const phone = String(formData.get(`${p}phone`) ?? '').trim();

  const anyFilled = Boolean(email || password || fullName || phone);
  if (!anyFilled) return { empty: true };

  if (!email || !password || !fullName) {
    return { error: 'Nombre, correo y contraseña son obligatorios para registrar a la persona.' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!email.includes('@')) {
    return { error: 'Correo inválido.' };
  }

  return {
    email: normalizeEmail(email),
    password,
    fullName,
    phone: phone || null,
  };
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc('get_user_id_by_email', { p_email: email });
  if (error) return null;
  return (data as string | null) ?? null;
}

/**
 * Create Auth user (or reuse existing) and upsert profile.
 * Existing users: profile updated; password is NOT changed.
 */
export async function ensureAuthUserAndProfile(
  person: ProvisionPersonInput,
): Promise<{ userId: string; created: boolean } | { error: string }> {
  const admin = createAdminClient();
  const email = normalizeEmail(person.email);

  let userId = await findUserIdByEmail(admin, email);
  let created = false;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: person.password,
      email_confirm: true,
      user_metadata: { full_name: person.fullName },
    });
    if (error || !data.user) {
      return { error: error?.message ?? 'No se pudo crear la cuenta.' };
    }
    userId = data.user.id;
    created = true;
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      full_name: person.fullName,
      phone: person.phone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    if (created) await admin.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  return { userId, created };
}

/**
 * Create Auth user (or reuse existing), upsert profile, ensure membership.
 * Existing users: profile updated; password is NOT changed.
 */
export async function provisionUserWithMembership(
  person: ProvisionPersonInput,
  membership: ProvisionMembershipInput,
): Promise<{ userId: string } | { error: string }> {
  const ensured = await ensureAuthUserAndProfile(person);
  if ('error' in ensured) return ensured;

  const { userId, created } = ensured;
  const admin = createAdminClient();

  const unitId = membership.unitId ?? null;
  const unitRelationship = membership.unitRelationship ?? null;
  const showPhoneInDirectory = membership.showPhoneInDirectory ?? false;

  if (unitId && (unitRelationship === 'owner' || unitRelationship === 'tenant')) {
    const { data: slotTaken } = await admin
      .from('memberships')
      .select('id, user_id')
      .eq('unit_id', unitId)
      .eq('unit_relationship', unitRelationship)
      .eq('status', 'active')
      .maybeSingle();

    if (slotTaken && slotTaken.user_id !== userId) {
      return {
        error:
          unitRelationship === 'owner'
            ? 'Esta unidad ya tiene un propietario registrado.'
            : 'Esta unidad ya tiene un inquilino registrado.',
      };
    }
  }

  const membershipQuery = admin
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('condominium_id', membership.condominiumId);

  const { data: existing } = unitId
    ? await membershipQuery.eq('unit_id', unitId).maybeSingle()
    : await membershipQuery.is('unit_id', null).maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('memberships')
      .update({
        role: membership.role,
        status: 'active',
        unit_relationship: unitRelationship,
        ...(membership.showPhoneInDirectory !== undefined
          ? { show_phone_in_directory: showPhoneInDirectory }
          : {}),
      })
      .eq('id', existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from('memberships').insert({
      user_id: userId,
      condominium_id: membership.condominiumId,
      role: membership.role,
      status: 'active',
      unit_id: unitId,
      unit_relationship: unitRelationship,
      show_phone_in_directory: showPhoneInDirectory,
    });
    if (error) {
      if (created) {
        await admin.auth.admin.deleteUser(userId);
      }
      return { error: error.message };
    }
  }

  return { userId };
}
