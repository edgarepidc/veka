import { notFound } from 'next/navigation';

import { GlassCard } from '@/components/ui/GlassCard';
import { loadPlatformStaffTeam } from '@/lib/load-platform-data';

import { PlatformAssignMemberForm } from '../PlatformAssignMemberForm';
import { PlatformRevokeButton } from '../PlatformRevokeButton';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export default async function PlatformCondominioEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await loadPlatformStaffTeam(id);
  if (!team) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-[var(--text)]">Equipo operativo</h2>
            <p className="text-xs text-subtle">Admins, guardias y staff del condominio</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {team.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-subtle">
                    Sin miembros de equipo asignados.
                  </td>
                </tr>
              ) : (
                team.members.map((member) => (
                  <tr key={member.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">
                        {member.full_name ?? member.email ?? member.user_id.slice(0, 8)}
                      </p>
                      {member.email ? <p className="text-xs text-subtle">{member.email}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{ROLE_LABELS[member.role] ?? member.role}</td>
                    <td className="px-4 py-3 capitalize text-muted">{member.status}</td>
                    <td className="px-4 py-3 text-right">
                      {member.status === 'active' && member.role !== 'super_admin' ? (
                        <PlatformRevokeButton membershipId={member.id} condominiumId={id} />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>

        {team.invitations.length > 0 ? (
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold text-[var(--text)]">Invitaciones de equipo pendientes</h2>
            </div>
            <ul className="divide-y divide-white/5">
              {team.invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[var(--text)]">
                    {inv.email} · {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                  <span className="glass-tag-green capitalize">{inv.status}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : null}
      </div>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Asignar administrador</h2>
        <p className="mt-1 text-sm text-muted">
          Agrega otro correo como admin, guardia o staff de este condominio.
        </p>
        <div className="mt-4">
          <PlatformAssignMemberForm condominiumId={id} />
        </div>
      </GlassCard>
    </div>
  );
}
