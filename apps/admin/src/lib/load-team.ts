import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import { isStaffRole, STAFF_SECTIONS, type MembershipRole } from '@veka/shared';

const CONFIG_TEAM_ROLES = STAFF_SECTIONS.flatMap((section) => section.roles);

export interface TeamMember {
  id: string;
  user_id: string;
  role: MembershipRole;
  status: string;
  full_name: string | null;
  phone: string | null;
  show_phone_in_directory: boolean;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: MembershipRole;
  status: string;
  created_at: string;
}

export async function loadStaffTeam(condominiumId?: string): Promise<{
  members: TeamMember[];
  invitations: StaffInvitation[];
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const [membersRes, invitationsRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, user_id, role, status, show_phone_in_directory, profile:profiles(full_name, phone)')
      .eq('condominium_id', condoId)
      .eq('status', 'active')
      .in('role', CONFIG_TEAM_ROLES)
      .order('role'),
    supabase
      .from('invitations')
      .select('id, email, role, status, created_at')
      .eq('condominium_id', condoId)
      .eq('status', 'pending')
      .is('unit_id', null)
      .in('role', CONFIG_TEAM_ROLES)
      .order('created_at', { ascending: false }),
  ]);

  const members = (membersRes.data ?? [])
    .filter((row) => CONFIG_TEAM_ROLES.includes(row.role as MembershipRole) && isStaffRole(row.role as MembershipRole))
    .map((row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role as MembershipRole,
        status: row.status,
        full_name: profile?.full_name ?? null,
        phone: profile?.phone?.trim() || null,
        show_phone_in_directory: Boolean(row.show_phone_in_directory),
      };
    });

  return {
    members,
    invitations: (invitationsRes.data ?? []) as StaffInvitation[],
  };
}
