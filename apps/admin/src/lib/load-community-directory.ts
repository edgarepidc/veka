import { COMMUNITY_DIRECTORY_ROLES, type MembershipRole } from '@veka/shared';

import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface CommunityDirectoryMember {
  membershipId: string;
  userId: string;
  role: MembershipRole;
  fullName: string;
  phone: string | null;
  unitIdentifier: string | null;
  clusterId: string | null;
  clusterName: string | null;
}

export async function loadCommunityDirectory(
  condominiumId?: string,
): Promise<CommunityDirectoryMember[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('memberships')
    .select(
      'id, user_id, role, show_phone_in_directory, unit:units(identifier, cluster_id, cluster:clusters(id, name)), profile:profiles(full_name, phone)',
    )
    .eq('condominium_id', condoId)
    .eq('status', 'active')
    .in('role', COMMUNITY_DIRECTORY_ROLES)
    .order('role');

  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    role: MembershipRole;
    show_phone_in_directory: boolean | null;
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
        }
      | {
          full_name: string | null;
          phone: string | null;
        }[]
      | null;
  }[];

  return rows.map((row) => {
    const unitRaw = Array.isArray(row.unit) ? row.unit[0] : row.unit;
    const clusterRaw = unitRaw?.cluster
      ? Array.isArray(unitRaw.cluster)
        ? unitRaw.cluster[0]
        : unitRaw.cluster
      : null;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    // Staff phone visibility is admin-controlled on the membership.
    const showPhone = Boolean(row.show_phone_in_directory);

    return {
      membershipId: row.id,
      userId: row.user_id,
      role: row.role,
      fullName: profile?.full_name?.trim() || 'Sin nombre',
      phone: showPhone ? profile?.phone?.trim() || null : null,
      unitIdentifier: unitRaw?.identifier ?? null,
      clusterId: unitRaw?.cluster_id ?? clusterRaw?.id ?? null,
      clusterName: clusterRaw?.name ?? null,
    };
  });
}
