import { useCallback, useEffect, useState } from 'react';
import {
  COMMITTEE_KIND_LABELS,
  COMMUNITY_DIRECTORY_ROLES,
  STAFF_ROLE_LABELS,
  STAFF_SECTIONS,
  type MembershipRole,
} from '@veka/shared';

import type { ActiveMembership } from '@/hooks/useMembership';
import { supabase } from '@/lib/supabase';

export interface DirectoryPerson {
  membershipId: string;
  role: MembershipRole;
  roleLabel: string;
  fullName: string;
  phone: string | null;
  unitIdentifier: string | null;
  clusterName: string | null;
  title?: string;
}

export interface DirectorySection {
  id: string;
  title: string;
  description: string;
  members: DirectoryPerson[];
}

export function useCommunityDirectory(primary: ActiveMembership | null) {
  const [sections, setSections] = useState<DirectorySection[]>([]);
  const [committee, setCommittee] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!primary?.condominium_id) {
      setSections([]);
      setCommittee([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);

    const [staffRes, committeeRes] = await Promise.all([
      supabase
        .from('memberships')
        .select(
          'id, role, show_phone_in_directory, unit:units(identifier, cluster:clusters(name)), profile:profiles(full_name, phone)',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'active')
        .in('role', COMMUNITY_DIRECTORY_ROLES),
      supabase
        .from('condo_committee_members')
        .select(
          'id, title, membership:memberships(id, role, unit:units(identifier, cluster:clusters(name)), profile:profiles(full_name, phone, show_phone_in_directory))',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('committee_kind', 'vigilance')
        .order('created_at', { ascending: true }),
    ]);

    const staffRows = (staffRes.data ?? []) as {
      id: string;
      role: MembershipRole;
      show_phone_in_directory: boolean | null;
      unit:
        | { identifier: string; cluster: { name: string } | { name: string }[] | null }
        | { identifier: string; cluster: { name: string } | { name: string }[] | null }[]
        | null;
      profile:
        | { full_name: string | null; phone: string | null }
        | { full_name: string | null; phone: string | null }[]
        | null;
    }[];

    const people = staffRows.map((row) => {
      const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
      const cluster = unit?.cluster
        ? Array.isArray(unit.cluster)
          ? unit.cluster[0]
          : unit.cluster
        : null;
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      const showPhone = Boolean(row.show_phone_in_directory);

      return {
        membershipId: row.id,
        role: row.role,
        roleLabel: STAFF_ROLE_LABELS[row.role] ?? row.role,
        fullName: profile?.full_name?.trim() || 'Sin nombre',
        phone: showPhone ? profile?.phone?.trim() || null : null,
        unitIdentifier: unit?.identifier ?? null,
        clusterName: cluster?.name ?? null,
      } satisfies DirectoryPerson;
    });

    setSections(
      STAFF_SECTIONS.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        members: people.filter((person) => section.roles.includes(person.role)),
      })),
    );

    const committeeRows = (committeeRes.data ?? []) as {
      title: string;
      membership:
        | {
            id: string;
            role: MembershipRole;
            unit:
              | { identifier: string; cluster: { name: string } | { name: string }[] | null }
              | { identifier: string; cluster: { name: string } | { name: string }[] | null }[]
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
            unit:
              | { identifier: string; cluster: { name: string } | { name: string }[] | null }
              | { identifier: string; cluster: { name: string } | { name: string }[] | null }[]
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

    setCommittee(
      committeeRows.map((row) => {
        const membership = Array.isArray(row.membership) ? row.membership[0] : row.membership;
        const unit = membership?.unit
          ? Array.isArray(membership.unit)
            ? membership.unit[0]
            : membership.unit
          : null;
        const cluster = unit?.cluster
          ? Array.isArray(unit.cluster)
            ? unit.cluster[0]
            : unit.cluster
          : null;
        const profile = membership?.profile
          ? Array.isArray(membership.profile)
            ? membership.profile[0]
            : membership.profile
          : null;
        const role = (membership?.role ?? 'resident') as MembershipRole;
        const showPhone = Boolean(profile?.show_phone_in_directory);

        return {
          membershipId: membership?.id ?? row.title,
          role,
          roleLabel: COMMITTEE_KIND_LABELS.vigilance,
          fullName: profile?.full_name?.trim() || 'Sin nombre',
          phone: showPhone ? profile?.phone?.trim() || null : null,
          unitIdentifier: unit?.identifier ?? null,
          clusterName: cluster?.name ?? null,
          title: row.title,
        } satisfies DirectoryPerson;
      }),
    );

    setLoading(false);
    setRefreshing(false);
  }, [primary?.condominium_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sections, committee, loading, refreshing, refresh };
}
