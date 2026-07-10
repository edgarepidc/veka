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
  id: string;
  membershipId: string | null;
  role: MembershipRole;
  roleLabel: string;
  fullName: string;
  phone: string | null;
  unitIdentifier: string | null;
  clusterName: string | null;
  title?: string;
  isManual?: boolean;
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

    const [staffRes, committeeRes, manualRes] = await Promise.all([
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
      supabase
        .from('directory_manual_entries')
        .select(
          'id, entry_kind, staff_section_id, committee_title, role_label, full_name, phone, unit_identifier, show_phone, cluster:clusters(name)',
        )
        .eq('condominium_id', primary.condominium_id)
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

    const people: DirectoryPerson[] = staffRows.map((row) => {
      const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
      const cluster = unit?.cluster
        ? Array.isArray(unit.cluster)
          ? unit.cluster[0]
          : unit.cluster
        : null;
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      const showPhone = Boolean(row.show_phone_in_directory);

      return {
        id: row.id,
        membershipId: row.id,
        role: row.role,
        roleLabel: STAFF_ROLE_LABELS[row.role] ?? row.role,
        fullName: profile?.full_name?.trim() || 'Sin nombre',
        phone: showPhone ? profile?.phone?.trim() || null : null,
        unitIdentifier: unit?.identifier ?? null,
        clusterName: cluster?.name ?? null,
      } satisfies DirectoryPerson;
    });

    const manualRows = (manualRes.data ?? []) as {
      id: string;
      entry_kind: 'staff' | 'committee';
      staff_section_id: string | null;
      committee_title: string | null;
      role_label: string | null;
      full_name: string;
      phone: string | null;
      unit_identifier: string | null;
      show_phone: boolean | null;
      cluster: { name: string } | { name: string }[] | null;
    }[];

    for (const row of manualRows) {
      const cluster = row.cluster ? (Array.isArray(row.cluster) ? row.cluster[0] : row.cluster) : null;
      const showPhone = Boolean(row.show_phone);
      if (row.entry_kind === 'staff' && row.staff_section_id) {
        const section = STAFF_SECTIONS.find((item) => item.id === row.staff_section_id);
        if (!section) continue;
        people.push({
          id: `manual-${row.id}`,
          membershipId: null,
          role: section.defaultInviteRole,
          roleLabel: row.role_label?.trim() || section.title,
          fullName: row.full_name.trim(),
          phone: showPhone ? row.phone?.trim() || null : null,
          unitIdentifier: row.unit_identifier?.trim() || null,
          clusterName: cluster?.name ?? null,
          isManual: true,
        });
      }
    }

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
      [
        ...committeeRows.map((row) => {
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
            id: membership?.id ?? row.title,
            membershipId: membership?.id ?? null,
            role,
            roleLabel: COMMITTEE_KIND_LABELS.vigilance,
            fullName: profile?.full_name?.trim() || 'Sin nombre',
            phone: showPhone ? profile?.phone?.trim() || null : null,
            unitIdentifier: unit?.identifier ?? null,
            clusterName: cluster?.name ?? null,
            title: row.title,
          } satisfies DirectoryPerson;
        }),
        ...manualRows
          .filter((row) => row.entry_kind === 'committee')
          .map((row) => {
            const cluster = row.cluster ? (Array.isArray(row.cluster) ? row.cluster[0] : row.cluster) : null;
            const showPhone = Boolean(row.show_phone);
            return {
              id: `manual-${row.id}`,
              membershipId: null,
              role: 'resident' as MembershipRole,
              roleLabel: COMMITTEE_KIND_LABELS.vigilance,
              fullName: row.full_name.trim(),
              phone: showPhone ? row.phone?.trim() || null : null,
              unitIdentifier: row.unit_identifier?.trim() || null,
              clusterName: cluster?.name ?? null,
              title: row.committee_title?.trim() || 'Integrante',
              isManual: true,
            } satisfies DirectoryPerson;
          }),
      ],
    );

    setLoading(false);
    setRefreshing(false);
  }, [primary?.condominium_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sections, committee, loading, refreshing, refresh };
}
