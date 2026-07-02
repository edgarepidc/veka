import type { MembershipRole } from '@veka/shared';
import { TEAM_STAFF_ROLES } from '@veka/shared';

import type { CondominiumStatus } from '@/lib/condominium-status';
import { parseCondominiumSettings, type CondominiumSettings } from '@/lib/condominium-settings';
import type { ClusterRow, UnitRow } from '@/lib/load-condominium';
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
  status: CondominiumStatus;
  created_at: string;
  organization: { id: string; name: string } | null;
  memberCount: number;
  unitCount: number;
  pendingInvitationCount: number;
  hasStaffAdmin: boolean;
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
    .select('id, name, slug, address, timezone, status, created_at, organization:organizations(id, name)')
    .order('created_at', { ascending: false });

  const rows = condos ?? [];

  const enriched = await Promise.all(
    rows.map(async (condo) => {
      const [membershipsRes, unitsRes, invitationsRes, staffRes] = await Promise.all([
        admin
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('condominium_id', condo.id)
          .eq('status', 'active'),
        admin
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('condominium_id', condo.id),
        admin
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('condominium_id', condo.id)
          .eq('status', 'pending'),
        admin
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('condominium_id', condo.id)
          .eq('status', 'active')
          .in('role', ['super_admin', 'admin']),
      ]);

      const organization = Array.isArray(condo.organization) ? condo.organization[0] : condo.organization;

      return {
        id: condo.id,
        name: condo.name,
        slug: condo.slug,
        address: condo.address,
        timezone: condo.timezone,
        status: (condo.status ?? 'active') as CondominiumStatus,
        created_at: condo.created_at,
        organization: organization ?? null,
        memberCount: membershipsRes.count ?? 0,
        unitCount: unitsRes.count ?? 0,
        pendingInvitationCount: invitationsRes.count ?? 0,
        hasStaffAdmin: (staffRes.count ?? 0) > 0,
      };
    }),
  );

  return enriched;
}

export interface PlatformInvitationRow {
  id: string;
  email: string;
  role: MembershipRole;
  status: string;
  created_at: string;
  unit_identifier: string | null;
}

export async function loadPlatformCondominiumSummary(condominiumId: string) {
  const admin = createAdminClient();

  const { data: condo } = await admin
    .from('condominiums')
    .select('id, name, slug, address, timezone, status, created_at, organization:organizations(id, name)')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return null;

  const organization = Array.isArray(condo.organization) ? condo.organization[0] : condo.organization;

  return {
    id: condo.id,
    name: condo.name,
    slug: condo.slug,
    address: condo.address,
    timezone: condo.timezone,
    status: (condo.status ?? 'active') as CondominiumStatus,
    created_at: condo.created_at,
    organization: organization ?? null,
  };
}

export async function loadPlatformCondominiumForConfig(condominiumId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from('condominiums')
    .select('id, name, slug, address, timezone, settings')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    settings: parseCondominiumSettings(data.settings),
  } as {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    settings: CondominiumSettings;
  };
}

export async function loadPlatformInvitations(condominiumId: string): Promise<PlatformInvitationRow[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('invitations')
    .select('id, email, role, status, created_at, unit:units(identifier)')
    .eq('condominium_id', condominiumId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => {
    const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
    return {
      id: row.id,
      email: row.email,
      role: row.role as MembershipRole,
      status: row.status,
      created_at: row.created_at,
      unit_identifier: unit?.identifier ?? null,
    };
  });
}

export async function loadPlatformClustersAndUnits(condominiumId: string): Promise<{
  clusters: ClusterRow[];
  units: UnitRow[];
}> {
  const admin = createAdminClient();

  const [clustersRes, unitsRes, membershipsRes, invitationsRes] = await Promise.all([
    admin.from('clusters').select('id, name').eq('condominium_id', condominiumId).order('name'),
    admin
      .from('units')
      .select('id, identifier, coefficient, cluster_id, unit_kind, unit_number, cluster:clusters(name)')
      .eq('condominium_id', condominiumId)
      .order('identifier'),
    admin
      .from('memberships')
      .select('unit_id, unit_relationship, profile:profiles(full_name)')
      .eq('condominium_id', condominiumId)
      .eq('status', 'active')
      .not('unit_id', 'is', null),
    admin
      .from('invitations')
      .select('unit_id, email, unit_relationship')
      .eq('condominium_id', condominiumId)
      .eq('status', 'pending')
      .not('unit_id', 'is', null),
  ]);

  const rawUnits = unitsRes.data ?? [];
  const baseUnits = rawUnits.map((row) => {
    const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
    return {
      id: row.id,
      identifier: row.identifier,
      coefficient: Number(row.coefficient),
      cluster_id: row.cluster_id,
      cluster: cluster ? { name: cluster.name } : null,
      unit_kind: row.unit_kind as import('@veka/shared').UnitKind | null,
      unit_number: row.unit_number ?? null,
    };
  });

  const { attachOccupancy } = await import('@/lib/load-condominium');
  const units = attachOccupancy(
    baseUnits,
    membershipsRes.data ?? [],
    invitationsRes.data ?? [],
  );

  return {
    clusters: (clustersRes.data as ClusterRow[]) ?? [],
    units,
  };
}

export async function loadPlatformStaffTeam(condominiumId: string) {
  const members = (await loadPlatformMembers(condominiumId)).filter((row) =>
    TEAM_STAFF_ROLES.includes(row.role),
  );
  const invitations = (await loadPlatformInvitations(condominiumId)).filter(
    (row) => row.status === 'pending' && TEAM_STAFF_ROLES.includes(row.role) && !row.unit_identifier,
  );

  return { members, invitations };
}

export async function loadPlatformCondominium(condominiumId: string) {
  const admin = createAdminClient();

  const { data: condo } = await admin
    .from('condominiums')
    .select('id, name, slug, address, timezone, status, created_at, organization:organizations(id, name)')
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

export interface PlatformAdminRow {
  user_id: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export async function loadPlatformAdmins(): Promise<PlatformAdminRow[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('platform_admins')
    .select('user_id, notes, created_at')
    .order('created_at', { ascending: true });

  const rows = data ?? [];

  return Promise.all(
    rows.map(async (row) => {
      const { data: authData } = await admin.auth.admin.getUserById(row.user_id);
      return {
        user_id: row.user_id,
        email: authData.user?.email ?? null,
        notes: row.notes,
        created_at: row.created_at,
      };
    }),
  );
}
