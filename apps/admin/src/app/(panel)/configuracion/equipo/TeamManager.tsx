'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  STAFF_ROLE_LABELS,
  STAFF_SECTIONS,
  type MembershipRole,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { StatChip } from '@/components/ui/StatChip';
import type { StaffInvitation, TeamMember } from '@/lib/load-team';

import { inviteStaffMember, setStaffPhoneVisibility, updateMemberRole } from './actions';
import { addManualStaffEntry, removeManualDirectoryEntry } from './manual-directory-actions';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';

const SECTION_ASSIGNABLE_ROLES: Record<string, MembershipRole[]> = {
  administrative: ['admin'],
  maintenance: ['staff'],
  security: ['guard'],
};

export function TeamManager({
  members,
  invitations,
  currentUserId,
  manualStaff = [],
}: {
  members: TeamMember[];
  invitations: StaffInvitation[];
  currentUserId: string;
  manualStaff?: ManualDirectoryEntry[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function runManualAdd(formData: FormData) {
    setMessage(null);
    start(async () => {
      const result = await addManualStaffEntry(formData);
      setMessage(result.error ?? 'Persona agregada al directorio.');
    });
  }

  function runManualRemove(entryId: string) {
    if (!confirm('¿Quitar esta persona del directorio manual?')) return;
    setMessage(null);
    start(async () => {
      const result = await removeManualDirectoryEntry(entryId);
      setMessage(result.error ?? 'Registro manual eliminado.');
    });
  }

  const sections = useMemo(
    () =>
      STAFF_SECTIONS.map((section) => ({
        section,
        members: members.filter((m) => section.roles.includes(m.role)),
        invitations: invitations.filter((i) => section.roles.includes(i.role)),
        manualEntries: manualStaff.filter((entry) => entry.staffSectionId === section.id),
      })),
    [invitations, manualStaff, members],
  );

  function isOpen(sectionId: string) {
    return expanded[sectionId] ?? false;
  }

  function toggle(sectionId: string) {
    setExpanded((prev) => ({ ...prev, [sectionId]: !isOpen(sectionId) }));
  }

  function runInvite(formData: FormData) {
    setMessage(null);
    start(async () => {
      const result = await inviteStaffMember(formData);
      setMessage(result.error ?? 'Invitación enviada.');
    });
  }

  function handleRoleChange(membershipId: string, role: MembershipRole) {
    setMessage(null);
    start(async () => {
      const result = await updateMemberRole(membershipId, role);
      setMessage(result.error ?? 'Rol actualizado.');
    });
  }

  function handlePhoneVisibility(membershipId: string, showPhone: boolean) {
    setMessage(null);
    start(async () => {
      const result = await setStaffPhoneVisibility(membershipId, showPhone);
      setMessage(result.error ?? (showPhone ? 'Teléfono visible en Mi comunidad.' : 'Teléfono oculto en Mi comunidad.'));
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Usuarios con rol en la app (acceso al panel o apps de campo). Los residentes se invitan desde
        Unidades; el comité de vigilancia se arma en Comunidad → Mi comunidad.
      </p>

      {message ? (
        <p
          className={`text-sm ${
            message.includes('Invitación') ||
            message.includes('actualizado') ||
            message.includes('Teléfono') ||
            message.includes('agregada') ||
            message.includes('eliminado')
              ? 'text-accent'
              : 'text-red-300'
          }`}
        >
          {message}
        </p>
      ) : null}

      {sections.map(({ section, members: sectionMembers, invitations: sectionInvites, manualEntries }) => {
        const open = isOpen(section.id);
        const pendingCount = sectionInvites.length;
        const registeredCount = sectionMembers.length;

        return (
          <GlassCard key={section.id} className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/5"
            >
              <Chevron open={open} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--text)]">{section.title}</p>
                <p className="mt-1 text-xs text-subtle">{section.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatChip label="Registrados" value={registeredCount} tone="green" />
                  {pendingCount > 0 ? (
                    <StatChip label="Invitaciones" value={pendingCount} tone="amber" />
                  ) : null}
                </div>
              </div>
            </button>

            {open ? (
              <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
                <form action={runInvite} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="role" value={section.defaultInviteRole} />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="correo@staff.com"
                    className="glass-input min-w-0 flex-1"
                  />
                  <button type="submit" disabled={pending} className="glass-btn-primary shrink-0">
                    Invitar a {section.title.toLowerCase()}
                  </button>
                </form>

                {sectionInvites.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                      Invitaciones pendientes
                    </p>
                    <ul className="space-y-2">
                      {sectionInvites.map((invite) => (
                        <li
                          key={invite.id}
                          className="glass-card-deep flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span className="text-[var(--text)]">{invite.email}</span>
                          <span className="glass-tag-amber px-2 py-0.5 text-xs capitalize">
                            Pendiente
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <ul className="space-y-2">
                  {sectionMembers.length === 0 ? (
                    <li className="glass-notice-amber text-sm">
                      Sin personal registrado en esta área.
                    </li>
                  ) : (
                    sectionMembers.map((member) => {
                      const isSelf = member.user_id === currentUserId;
                      const canEdit = member.role !== 'super_admin';
                      const assignable = SECTION_ASSIGNABLE_ROLES[section.id] ?? [];

                      return (
                        <li
                          key={member.id}
                          className="glass-card-deep flex flex-col gap-3 px-4 py-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-[var(--text)]">
                                {member.full_name ?? 'Sin nombre'}
                                {isSelf ? <span className="ml-2 text-xs text-subtle">(tú)</span> : null}
                              </p>
                              <p className="text-xs text-subtle">
                                {STAFF_ROLE_LABELS[member.role]}
                                {member.phone ? ` · ${member.phone}` : ' · Sin teléfono en perfil'}
                              </p>
                            </div>

                            {canEdit && assignable.length > 0 ? (
                              <select
                                value={member.role}
                                disabled={pending}
                                onChange={(e) => handleRoleChange(member.id, e.target.value as MembershipRole)}
                                className="glass-input w-full sm:w-52"
                              >
                                {assignable.map((role) => (
                                  <option key={role} value={role} className="bg-slate-900">
                                    {STAFF_ROLE_LABELS[role]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="glass-tag-green text-xs">{STAFF_ROLE_LABELS[member.role]}</span>
                            )}
                          </div>

                          <label className="flex items-start gap-2 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={member.show_phone_in_directory}
                              disabled={pending || !member.phone}
                              onChange={(event) =>
                                handlePhoneVisibility(member.id, event.target.checked)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-white/20"
                            />
                            <span>
                              Mostrar teléfono en Comunidad → Mi comunidad
                              {!member.phone ? (
                                <span className="mt-0.5 block text-subtle">
                                  La persona debe guardar un teléfono en su perfil primero.
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-[var(--text)]">Registrar sin cuenta en la app</p>
                  <p className="mt-1 text-xs text-subtle">
                    Para personal que no usará Veka pero debe aparecer en Mi comunidad.
                  </p>
                  <form action={runManualAdd} className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input type="hidden" name="staff_section_id" value={section.id} />
                    <input
                      type="text"
                      name="full_name"
                      required
                      placeholder="Nombre completo"
                      className="glass-input sm:col-span-2"
                    />
                    <input type="text" name="role_label" placeholder="Cargo (opcional)" className="glass-input" />
                    <input type="text" name="phone" placeholder="Teléfono" className="glass-input" />
                    <input
                      type="text"
                      name="unit_identifier"
                      placeholder="Depto / área (opcional)"
                      className="glass-input sm:col-span-2"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
                      <input type="checkbox" name="show_phone" defaultChecked className="h-4 w-4 rounded border-white/20" />
                      Mostrar teléfono en Mi comunidad
                    </label>
                    <button type="submit" disabled={pending} className="glass-btn-primary sm:col-span-2">
                      Agregar al directorio
                    </button>
                  </form>

                  {manualEntries.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {manualEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="glass-card-deep flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-[var(--text)]">{entry.fullName}</p>
                            <p className="text-xs text-subtle">
                              {entry.roleLabel ?? section.title}
                              {entry.unitIdentifier ? ` · ${entry.unitIdentifier}` : ''}
                              {entry.phone ? ` · Tel. ${entry.phone}` : ''}
                              {' · Sin cuenta en app'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => runManualRemove(entry.id)}
                            className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </GlassCard>
        );
      })}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-subtle">
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
