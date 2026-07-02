import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformCondominium } from '@/lib/load-platform-data';

import { PlatformAssignMemberForm } from './PlatformAssignMemberForm';
import { PlatformRevokeButton } from './PlatformRevokeButton';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export default async function PlatformCondominioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const condo = await loadPlatformCondominium(id);
  if (!condo) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-4 text-sm text-muted">
        <Link href="/platform/condominios" className="text-violet-300 hover:underline">
          ← Condominios
        </Link>
      </p>

      <PageHeader title={condo.name} highlight="usuarios" subtitle={condo.organization?.name ?? 'Sin organización'} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Meta label="Slug" value={condo.slug} />
        <Meta label="Zona horaria" value={condo.timezone} />
        <Meta label="Alta" value={new Date(condo.created_at).toLocaleDateString('es-MX')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="font-semibold text-[var(--text)]">Usuarios del condominio</h2>
            <p className="text-xs text-subtle">{condo.members.length} membresías</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Unidad</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {condo.members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                    Sin usuarios asignados todavía.
                  </td>
                </tr>
              ) : (
                condo.members.map((member) => (
                  <tr key={member.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">
                        {member.full_name ?? member.email ?? member.user_id.slice(0, 8)}
                      </p>
                      {member.email ? <p className="text-xs text-subtle">{member.email}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{ROLE_LABELS[member.role] ?? member.role}</td>
                    <td className="px-4 py-3 text-muted">{member.unit_identifier ?? '—'}</td>
                    <td className="px-4 py-3 capitalize text-muted">{member.status}</td>
                    <td className="px-4 py-3 text-right">
                      {member.status === 'active' && !member.unit_id ? (
                        <PlatformRevokeButton membershipId={member.id} condominiumId={condo.id} />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Asignar administrador</h2>
          <p className="mt-1 text-sm text-muted">
            Multi-admin: agrega otro correo como admin o super_admin de este condominio.
          </p>
          <div className="mt-4">
            <PlatformAssignMemberForm condominiumId={condo.id} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-sm text-[var(--text)]">{value}</p>
    </div>
  );
}
