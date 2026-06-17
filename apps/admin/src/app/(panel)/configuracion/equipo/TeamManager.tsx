'use client';

import { useState, useTransition } from 'react';

import { MEMBERSHIP_ROLES, type MembershipRole } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import type { TeamMember } from '@/lib/load-team';

import { updateMemberRole } from './actions';

const ROLE_LABELS: Record<MembershipRole, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

const ASSIGNABLE_ROLES = MEMBERSHIP_ROLES.filter((r) => r !== 'super_admin');

export function TeamManager({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleRoleChange(membershipId: string, role: MembershipRole) {
    setMessage(null);
    start(async () => {
      const result = await updateMemberRole(membershipId, role);
      setMessage(result.error ?? 'Rol actualizado.');
    });
  }

  return (
    <GlassCard>
      <h2 className="text-lg font-semibold text-[var(--text)]">Equipo activo</h2>
      <p className="mt-1 text-sm text-muted">
        Usuarios con acceso al condominio. Cambia roles de guardias, personal o administradores.
      </p>

      {message ? (
        <p className={`mt-4 text-sm ${message.includes('actualizado') ? 'text-accent' : 'text-red-300'}`}>
          {message}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {members.length === 0 ? (
          <li className="text-sm text-subtle">No hay miembros activos.</li>
        ) : (
          members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const canEdit = member.role !== 'super_admin';

            return (
              <li
                key={member.id}
                className="glass-card-deep flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {member.full_name ?? 'Sin nombre'}
                    {isSelf ? <span className="ml-2 text-xs text-subtle">(tú)</span> : null}
                  </p>
                  <p className="text-xs text-subtle">
                    {ROLE_LABELS[member.role]}
                    {member.unit_identifier ? ` · ${member.unit_identifier}` : ''}
                  </p>
                </div>

                {canEdit ? (
                  <select
                    value={member.role}
                    disabled={pending}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as MembershipRole)}
                    className="glass-input w-full sm:w-48"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role} className="bg-slate-900">
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="glass-tag-green text-xs">{ROLE_LABELS[member.role]}</span>
                )}
              </li>
            );
          })
        )}
      </ul>
    </GlassCard>
  );
}
