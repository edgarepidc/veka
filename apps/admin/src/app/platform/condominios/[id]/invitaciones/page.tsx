import { notFound } from 'next/navigation';

import { PlatformInvitationActions } from '@/app/platform/condominios/[id]/PlatformInvitationActions';
import { GlassCard } from '@/components/ui/GlassCard';
import { loadPlatformInvitations } from '@/lib/load-platform-data';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export default async function PlatformCondominioInvitacionesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invitations = await loadPlatformInvitations(id);
  if (invitations === null) notFound();

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="font-semibold text-[var(--text)]">Invitaciones</h2>
        <p className="text-xs text-subtle">Pendientes y procesadas para este condominio</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-subtle">
          <tr>
            <th className="px-4 py-2">Correo</th>
            <th className="px-4 py-2">Rol</th>
            <th className="px-4 py-2">Unidad</th>
            <th className="px-4 py-2">Estado</th>
            <th className="px-4 py-2">Fecha</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {invitations.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                No hay invitaciones registradas.
              </td>
            </tr>
          ) : (
            invitations.map((inv) => (
              <tr key={inv.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-[var(--text)]">{inv.email}</td>
                <td className="px-4 py-3 text-muted">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                <td className="px-4 py-3 text-muted">{inv.unit_identifier ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-muted">{inv.status}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(inv.created_at).toLocaleDateString('es-MX')}
                </td>
                <td className="px-4 py-3">
                  <PlatformInvitationActions
                    invitationId={inv.id}
                    condominiumId={id}
                    status={inv.status}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </GlassCard>
  );
}
