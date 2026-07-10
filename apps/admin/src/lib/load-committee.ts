import { STAFF_ROLE_LABELS, type CommitteeKind, type MembershipRole } from '@veka/shared';

import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface ResidentDirectoryRow {
  membershipId: string;
  userId: string;
  fullName: string;
  phone: string | null;
  role: MembershipRole;
  roleLabel: string;
  unitIdentifier: string | null;
  clusterId: string | null;
  clusterName: string | null;
  unitRelationship: string | null;
}

export interface CommitteeMemberRow {
  id: string;
  membershipId: string | null;
  committeeKind: CommitteeKind;
  title: string;
  fullName: string;
  phone: string | null;
  role: MembershipRole;
  roleLabel: string;
  unitIdentifier: string | null;
  clusterId: string | null;
  clusterName: string | null;
  isManual?: boolean;
}

function relationshipLabel(value: string | null): string | null {
  if (value === 'owner') return 'Residente propietario';
  if (value === 'tenant') return 'Residente inquilino';
  return null;
}

export async function loadResidentDirectory(
  condominiumId?: string,
  clusterId?: string | null,
): Promise<ResidentDirectoryRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('memberships')
    .select(
      'id, user_id, role, unit_relationship, unit:units(id, identifier, cluster_id, cluster:clusters(id, name)), profile:profiles(full_name, phone, show_phone_in_directory)',
    )
    .eq('condominium_id', condoId)
    .eq('status', 'active')
    .eq('role', 'resident')
    .not('unit_id', 'is', null)
    .order('role');

  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    role: MembershipRole;
    unit_relationship: string | null;
    unit:
      | {
          id: string;
          identifier: string;
          cluster_id: string | null;
          cluster: { id: string; name: string } | { id: string; name: string }[] | null;
        }
      | {
          id: string;
          identifier: string;
          cluster_id: string | null;
          cluster: { id: string; name: string } | { id: string; name: string }[] | null;
        }[]
      | null;
    profile:
      | {
          full_name: string | null;
          phone: string | null;
          show_phone_in_directory: boolean | null;
        }
      | {
          full_name: string | null;
          phone: string | null;
          show_phone_in_directory: boolean | null;
        }[]
      | null;
  }[];

  return rows
    .map((row) => {
      const unitRaw = Array.isArray(row.unit) ? row.unit[0] : row.unit;
      const clusterRaw = unitRaw?.cluster
        ? Array.isArray(unitRaw.cluster)
          ? unitRaw.cluster[0]
          : unitRaw.cluster
        : null;
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      const role = row.role;
      const rel = relationshipLabel(row.unit_relationship);
      const roleLabel =
        role === 'resident' && rel ? rel : STAFF_ROLE_LABELS[role] ?? role;
      const showPhone = Boolean(profile?.show_phone_in_directory);

      return {
        membershipId: row.id,
        userId: row.user_id,
        fullName: profile?.full_name?.trim() || 'Sin nombre',
        phone: showPhone ? profile?.phone?.trim() || null : null,
        role,
        roleLabel,
        unitIdentifier: unitRaw?.identifier ?? null,
        clusterId: unitRaw?.cluster_id ?? clusterRaw?.id ?? null,
        clusterName: clusterRaw?.name ?? null,
        unitRelationship: row.unit_relationship,
      };
    })
    .filter((row) => !clusterId || row.clusterId === clusterId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

export async function loadCommitteeMembers(
  condominiumId?: string,
  committeeKind: CommitteeKind = 'vigilance',
): Promise<CommitteeMemberRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('condo_committee_members')
    .select(
      'id, membership_id, committee_kind, title, membership:memberships(id, role, unit_relationship, unit:units(identifier, cluster_id, cluster:clusters(id, name)), profile:profiles(full_name, phone, show_phone_in_directory))',
    )
    .eq('condominium_id', condoId)
    .eq('committee_kind', committeeKind)
    .order('created_at', { ascending: true });

  const rows = (data ?? []) as {
    id: string;
    membership_id: string;
    committee_kind: CommitteeKind;
    title: string;
    membership:
      | {
          id: string;
          role: MembershipRole;
          unit_relationship: string | null;
          unit:
            | {
                identifier: string;
                cluster_id: string | null;
                cluster: { id: string; name: string } | { id: string; name: string }[] | null;
              }
            | {
                identifier: string;
                cluster_id: string | null;
                cluster: { id: string; name: string } | { id: string; name: string }[] | null;
              }[]
            | null;
          profile:
            | {
                full_name: string | null;
                phone: string | null;
                show_phone_in_directory: boolean | null;
              }
            | {
                full_name: string | null;
                phone: string | null;
                show_phone_in_directory: boolean | null;
              }[]
            | null;
        }
      | {
          id: string;
          role: MembershipRole;
          unit_relationship: string | null;
          unit:
            | {
                identifier: string;
                cluster_id: string | null;
                cluster: { id: string; name: string } | { id: string; name: string }[] | null;
              }
            | {
                identifier: string;
                cluster_id: string | null;
                cluster: { id: string; name: string } | { id: string; name: string }[] | null;
              }[]
            | null;
          profile:
            | {
                full_name: string | null;
                phone: string | null;
                show_phone_in_directory: boolean | null;
              }
            | {
                full_name: string | null;
                phone: string | null;
                show_phone_in_directory: boolean | null;
              }[]
            | null;
        }[]
      | null;
  }[];

  return rows.map((row) => {
    const membership = Array.isArray(row.membership) ? row.membership[0] : row.membership;
    const unitRaw = membership?.unit
      ? Array.isArray(membership.unit)
        ? membership.unit[0]
        : membership.unit
      : null;
    const clusterRaw = unitRaw?.cluster
      ? Array.isArray(unitRaw.cluster)
        ? unitRaw.cluster[0]
        : unitRaw.cluster
      : null;
    const profile = membership?.profile
      ? Array.isArray(membership.profile)
        ? membership.profile[0]
        : membership.profile
      : null;
    const role = (membership?.role ?? 'resident') as MembershipRole;
    const rel = relationshipLabel(membership?.unit_relationship ?? null);
    const roleLabel = role === 'resident' && rel ? rel : STAFF_ROLE_LABELS[role] ?? role;
    const showPhone = Boolean(profile?.show_phone_in_directory);

    return {
      id: row.id,
      membershipId: row.membership_id,
      committeeKind: row.committee_kind,
      title: row.title,
      fullName: profile?.full_name?.trim() || 'Sin nombre',
      phone: showPhone ? profile?.phone?.trim() || null : null,
      role,
      roleLabel,
      unitIdentifier: unitRaw?.identifier ?? null,
      clusterId: unitRaw?.cluster_id ?? clusterRaw?.id ?? null,
      clusterName: clusterRaw?.name ?? null,
    };
  });
}
