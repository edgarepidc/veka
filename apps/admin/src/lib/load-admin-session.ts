import { isAdminRole, type MembershipRole } from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export interface AdminSession {
  userId: string;
  email: string;
  profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
  membership: {
    role: MembershipRole;
    condominium_id: string;
    condominium_name: string;
  } | null;
  isAdmin: boolean;
}

export async function loadAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, membershipRes] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('role, condominium_id, condominium:condominiums(name)')
      .eq('user_id', user.id)
      .eq('condominium_id', DEMO_CONDO_ID)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const membershipRow = membershipRes.data as {
    role: MembershipRole;
    condominium_id: string;
    condominium: { name: string } | null;
  } | null;

  const role = membershipRow?.role ?? 'resident';

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: {
      full_name: profileRes.data?.full_name ?? null,
      phone: profileRes.data?.phone ?? null,
      avatar_url: profileRes.data?.avatar_url ?? null,
    },
    membership: membershipRow
      ? {
          role: membershipRow.role,
          condominium_id: membershipRow.condominium_id,
          condominium_name: membershipRow.condominium?.name ?? 'Condominio',
        }
      : null,
    isAdmin: isAdminRole(role),
  };
}
