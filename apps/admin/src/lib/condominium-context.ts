import { cookies } from 'next/headers';
import { isAdminRole, type MembershipRole } from '@veka/shared';

import { readImpersonationCookie } from '@/lib/impersonation';
import { isPlatformAdminUser } from '@/lib/platform-admin';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_CONDO_COOKIE = 'veka_active_condo_id';

export interface UserCondominium {
  id: string;
  name: string;
  role: MembershipRole;
}

function uniqueCondominiums(rows: UserCondominium[]): UserCondominium[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function loadUserCondominiums(userId: string): Promise<UserCondominium[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('memberships')
    .select('role, condominium_id, condominium:condominiums(id, name)')
    .eq('user_id', userId)
    .eq('status', 'active');

  const rows =
    (data as {
      role: MembershipRole;
      condominium_id: string;
      condominium: { id: string; name: string } | { id: string; name: string }[] | null;
    }[] | null) ?? [];

  return uniqueCondominiums(
    rows.map((row) => {
      const condo = Array.isArray(row.condominium) ? row.condominium[0] : row.condominium;
      return {
        id: condo?.id ?? row.condominium_id,
        name: condo?.name ?? 'Condominio',
        role: row.role,
      };
    }),
  );
}

export async function readActiveCondominiumCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_CONDO_COOKIE)?.value?.trim();
  return value || null;
}

export function pickActiveCondominiumId(
  condominiums: UserCondominium[],
  preferredId?: string | null,
): string | null {
  if (condominiums.length === 0) return null;

  const allowed = new Set(condominiums.map((row) => row.id));
  if (preferredId && allowed.has(preferredId)) return preferredId;

  const adminCondo = condominiums.find((row) => isAdminRole(row.role));
  return adminCondo?.id ?? condominiums[0]!.id;
}

export async function resolveActiveCondominiumId(
  userId: string,
  preferredId?: string | null,
): Promise<string | null> {
  const condominiums = await loadUserCondominiums(userId);
  const cookieId = preferredId ?? (await readActiveCondominiumCookie());
  return pickActiveCondominiumId(condominiums, cookieId);
}

export async function userCanAccessCondominium(userId: string, condominiumId: string): Promise<boolean> {
  const condominiums = await loadUserCondominiums(userId);
  return condominiums.some((row) => row.id === condominiumId);
}

export async function requireActiveCondominiumId(
  formValue?: string | null,
): Promise<string | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const condominiums = await loadUserCondominiums(user.id);
  if (condominiums.length === 0) {
    return { error: 'No tienes un condominio asignado. Completa el onboarding primero.' };
  }

  const cookieId = await readActiveCondominiumCookie();
  const requested = formValue?.trim() || cookieId;
  const condoId = pickActiveCondominiumId(condominiums, requested);

  if (!condoId) return { error: 'Condominio no válido.' };
  return condoId;
}

export async function getLoaderCondominiumId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('No autorizado');

  const impersonateId = await readImpersonationCookie();
  if (impersonateId && (await isPlatformAdminUser(user.id, user.email))) {
    return impersonateId;
  }

  const condoId = await resolveActiveCondominiumId(user.id);
  if (!condoId) throw new Error('Sin condominio activo');

  return condoId;
}

export function slugifyCondominiumName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
