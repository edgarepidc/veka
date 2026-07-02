import { isAdminRole, type MembershipRole } from '@veka/shared';

import {
  loadUserCondominiums,
  pickActiveCondominiumId,
  readActiveCondominiumCookie,
  type UserCondominium,
} from '@/lib/condominium-context';
import type { CondominiumStatus } from '@/lib/condominium-status';
import { readImpersonationCookie } from '@/lib/impersonation';
import { isPlatformAdminUser } from '@/lib/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface AdminSession {
  userId: string;
  email: string;
  profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
  condominiums: UserCondominium[];
  activeCondominiumId: string | null;
  membership: {
    role: MembershipRole;
    condominium_id: string;
    condominium_name: string;
    unit_id: string | null;
    unit_identifier: string | null;
  } | null;
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonatedCondominiumStatus: CondominiumStatus | null;
}

export async function loadAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, condominiums, cookieId, impersonateId, isPlatform] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle(),
    loadUserCondominiums(user.id),
    readActiveCondominiumCookie(),
    readImpersonationCookie(),
    isPlatformAdminUser(user.id, user.email),
  ]);

  let effectiveCondominiums = condominiums;
  let activeCondominiumId = pickActiveCondominiumId(condominiums, cookieId);
  let isImpersonating = false;
  let impersonatedCondominiumStatus: CondominiumStatus | null = null;

  if (isPlatform && impersonateId) {
    const admin = createAdminClient();
    const { data: condo } = await admin
      .from('condominiums')
      .select('id, name, status')
      .eq('id', impersonateId)
      .maybeSingle();

    if (condo) {
      isImpersonating = true;
      impersonatedCondominiumStatus = (condo.status ?? 'active') as CondominiumStatus;
      effectiveCondominiums = [{ id: condo.id, name: condo.name, role: 'super_admin' }];
      activeCondominiumId = condo.id;
    }
  }

  const membershipRes =
    activeCondominiumId && !isImpersonating
      ? await supabase
          .from('memberships')
          .select('role, condominium_id, unit_id, condominium:condominiums(name), unit:units(identifier)')
          .eq('user_id', user.id)
          .eq('condominium_id', activeCondominiumId)
          .eq('status', 'active')
          .maybeSingle()
      : { data: null };

  const membershipRow = membershipRes.data as {
    role: MembershipRole;
    condominium_id: string;
    unit_id: string | null;
    condominium: { name: string } | null;
    unit: { identifier: string } | null;
  } | null;

  const activeCondo = effectiveCondominiums.find((row) => row.id === activeCondominiumId);
  const role = isImpersonating
    ? 'super_admin'
    : (membershipRow?.role ?? activeCondo?.role ?? 'resident');

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: {
      full_name: profileRes.data?.full_name ?? null,
      phone: profileRes.data?.phone ?? null,
      avatar_url: profileRes.data?.avatar_url ?? null,
    },
    condominiums: effectiveCondominiums,
    activeCondominiumId,
    membership: activeCondominiumId
      ? {
          role,
          condominium_id: activeCondominiumId,
          condominium_name:
            membershipRow?.condominium?.name ?? activeCondo?.name ?? 'Condominio',
          unit_id: membershipRow?.unit_id ?? null,
          unit_identifier: membershipRow?.unit?.identifier ?? null,
        }
      : null,
    isAdmin: isAdminRole(role),
    isImpersonating,
    impersonatedCondominiumStatus,
  };
}
