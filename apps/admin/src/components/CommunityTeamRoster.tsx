'use client';

import { STAFF_ROLE_LABELS, STAFF_SECTIONS, type MembershipRole } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import type { CommunityDirectoryMember } from '@/lib/load-community-directory';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';

type RosterMember = CommunityDirectoryMember & {
  isManual?: boolean;
  roleLabel?: string | null;
};

export function CommunityTeamRoster({
  members,
  manualStaff = [],
  clusterId,
  scopeLabel,
}: {
  members: CommunityDirectoryMember[];
  manualStaff?: ManualDirectoryEntry[];
  clusterId: string;
  scopeLabel: string;
}) {
  const sections = STAFF_SECTIONS.map((section) => ({
    section,
    members: [
      ...members.filter((member) => {
        if (!section.roles.includes(member.role)) return false;
        if (!clusterId) return true;
        if (!member.clusterId) return true;
        return member.clusterId === clusterId;
      }),
      ...manualStaff
        .filter((entry) => entry.staffSectionId === section.id)
        .map(
          (entry): RosterMember => ({
            membershipId: `manual-${entry.id}`,
            userId: `manual-${entry.id}`,
            role: section.defaultInviteRole,
            fullName: entry.fullName,
            phone: entry.phone,
            unitIdentifier: entry.unitIdentifier,
            clusterId: entry.clusterId,
            clusterName: entry.clusterName,
            isManual: true,
            roleLabel: entry.roleLabel,
          }),
        ),
    ] as RosterMember[],
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Directorio del equipo para residentes · {scopeLabel}. Solo lectura; invitaciones y visibilidad de
        teléfono del staff se gestionan en Configuración → Equipo.
      </p>

      {sections.map(({ section, members: sectionMembers }) => (
        <GlassCard key={section.id} className="!p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--text)]">{section.title}</p>
              <p className="mt-1 text-xs text-subtle">{section.description}</p>
            </div>
            <span className="glass-tag-green text-[11px]">
              {sectionMembers.length} registrado{sectionMembers.length === 1 ? '' : 's'}
            </span>
          </div>

          <ul className="mt-4 space-y-2">
            {sectionMembers.length === 0 ? (
              <li className="text-sm text-subtle">Sin personas registradas en esta área.</li>
            ) : (
              sectionMembers.map((member) => (
                <li key={member.membershipId} className="glass-card-deep px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text)]">{member.fullName}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {member.roleLabel ?? STAFF_ROLE_LABELS[member.role as MembershipRole] ?? member.role}
                    {member.isManual ? ' · Sin cuenta en app' : ''}
                    {member.unitIdentifier ? ` · ${member.unitIdentifier}` : ''}
                    {member.clusterName
                      ? ` · ${member.clusterName}`
                      : member.unitIdentifier
                        ? ''
                        : ' · Condominio general'}
                    {member.phone ? ` · Tel. ${member.phone}` : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
        </GlassCard>
      ))}
    </div>
  );
}
