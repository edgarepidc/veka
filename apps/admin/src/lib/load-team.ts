import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import type { MembershipRole } from '@veka/shared';

export interface TeamMember {
  id: string;
  user_id: string;
  role: MembershipRole;
  status: string;
  full_name: string | null;
  unit_identifier: string | null;
}

export async function loadTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, profile:profiles(full_name), unit:units(identifier)')
    .eq('condominium_id', DEMO_CONDO_ID)
    .eq('status', 'active')
    .order('role');

  const rows = data ?? [];

  return rows.map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;

    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role as MembershipRole,
      status: row.status,
      full_name: profile?.full_name ?? null,
      unit_identifier: unit?.identifier ?? null,
    };
  });
}
