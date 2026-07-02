import { isAdminRole, type MembershipRole } from '@veka/shared';

import {
  loadUserCondominiums,
  pickActiveCondominiumId,
  readActiveCondominiumCookie,
  type UserCondominium,
} from '@/lib/condominium-context';
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
}

export async function loadAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, condominiums, cookieId] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle(),
    loadUserCondominiums(user.id),
    readActiveCondominiumCookie(),
  ]);

  const activeCondominiumId = pickActiveCondominiumId(condominiums, cookieId);

  const membershipRes = activeCondominiumId
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

  const activeCondo = condominiums.find((row) => row.id === activeCondominiumId);
  const role = membershipRow?.role ?? activeCondo?.role ?? 'resident';

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: {
      full_name: profileRes.data?.full_name ?? null,
      phone: profileRes.data?.phone ?? null,
      avatar_url: profileRes.data?.avatar_url ?? null,
    },
    condominiums,
    activeCondominiumId,
    membership: membershipRow
      ? {
          role: membershipRow.role,
          condominium_id: membershipRow.condominium_id,
          condominium_name: membershipRow.condominium?.name ?? activeCondo?.name ?? 'Condominio',
          unit_id: membershipRow.unit_id,
          unit_identifier: membershipRow.unit?.identifier ?? null,
        }
      : activeCondo
        ? {
            role: activeCondo.role,
            condominium_id: activeCondo.id,
            condominium_name: activeCondo.name,
            unit_id: null,
            unit_identifier: null,
          }
        : null,
    isAdmin: isAdminRole(role),
  };
}
