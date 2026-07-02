import type { MembershipRole } from '@veka/shared';

import { createAdminClient } from '@/lib/supabase/admin';

export interface PlatformStats {
  organizations: number;
  condominiums: number;
  activeMemberships: number;
  pendingInvitations: number;
}

export interface PlatformCondominiumRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  created_at: string;
  organization: { id: string; name: string } | null;
  memberCount: number;
}

export interface PlatformMemberRow {
  id: string;
  user_id: string;
  role: MembershipRole;
  status: string;
  unit_id: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  unit_identifier: string | null;
}

export async function loadPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();

  const [orgs, condos, memberships, invitations] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('condominiums').select('id', { count: 'exact', head: true }),
    admin.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('invitations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return {
    organizations: orgs.count ?? 0,
    condominiums: condos.count ?? 0,
    activeMemberships: memberships.count ?? 0,
    pendingInvitations: invitations.count ?? 0,
  };
}

export async function loadPlatformCondominiums(): Promise<PlatformCondominiumRow[]> {
  const admin = createAdminClient();

  const { data: condos } = await admin
    .from('condominiums')
    .select('id, name, slug, address, timezone, created_at, organization:organizations(id, name)')
    .order('created_at', { ascending: false });

  const rows = condos ?? [];
  const counts = await Promise.all(
    rows.map(async (condo) => {
      const { count } = await admin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('condominium_id', condo.id)
        .eq('status', 'active');
      return count ?? 0;
    }),
  );

  return rows.map((row, index) => {
    const organization = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      timezone: row.timezone,
      created_at: row.created_at,
      organization: organization ?? null,
      memberCount: counts[index] ?? 0,
    };
  });
}

export async function loadPlatformCondominium(condominiumId: string) {
  const admin = createAdminClient();

  const { data: condo } = await admin
    .from('condominiums')
    .select('id, name, slug, address, timezone, created_at, organization:organizations(id, name)')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return null;

  const organization = Array.isArray(condo.organization) ? condo.organization[0] : condo.organization;
  const members = await loadPlatformMembers(condominiumId);

  return {
    id: condo.id,
    name: condo.name,
    slug: condo.slug,
    address: condo.address,
    timezone: condo.timezone,
    created_at: condo.created_at,
    organization: organization ?? null,
    members,
  };
}

export async function loadPlatformMembers(condominiumId: string): Promise<PlatformMemberRow[]> {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from('memberships')
    .select('id, user_id, role, status, unit_id, created_at, profile:profiles(full_name), unit:units(identifier)')
    .eq('condominium_id', condominiumId)
    .order('created_at', { ascending: true });

  const rows = memberships ?? [];

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
      const { data: authData } = await admin.auth.admin.getUserById(row.user_id);

      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role as MembershipRole,
        status: row.status,
        unit_id: row.unit_id,
        created_at: row.created_at,
        full_name: profile?.full_name ?? null,
        email: authData.user?.email ?? null,
        unit_identifier: unit?.identifier ?? null,
      };
    }),
  );

  return enriched;
}
