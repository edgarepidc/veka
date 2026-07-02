import Link from 'next/link';

import { PlatformImpersonateButton } from '@/app/platform/condominios/[id]/PlatformImpersonateButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  CONDOMINIUM_STATUS_LABELS,
  TENANT_HEALTH_LABELS,
  deriveTenantHealth,
  healthBadgeClass,
  statusBadgeClass,
} from '@/lib/condominium-status';
import { loadPlatformCondominiums } from '@/lib/load-platform-data';

export default async function PlatformCondominiosPage() {
  const condominiums = await loadPlatformCondominiums();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Condominios"
          highlight="en Veka"
          subtitle="Estado operativo, usuarios y acceso rápido a cada tenant."
        />
        <Link href="/platform/condominios/nuevo" className="glass-btn-primary text-sm">
          + Nuevo condominio
        </Link>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3">Condominio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Unidades</th>
              <th className="px-4 py-3">Invit. pend.</th>
              <th className="px-4 py-3">Usuarios</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {condominiums.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-subtle">
                  No hay condominios todavía.
                </td>
              </tr>
            ) : (
              condominiums.map((condo) => {
                const health = deriveTenantHealth({
                  status: condo.status,
                  hasStaffAdmin: condo.hasStaffAdmin,
                  unitCount: condo.unitCount,
                });

                return (
                  <tr key={condo.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{condo.name}</p>
                      <p className="text-xs text-subtle">{condo.organization?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={statusBadgeClass(condo.status)}>
                          {CONDOMINIUM_STATUS_LABELS[condo.status]}
                        </span>
                        {health ? (
                          <span className={healthBadgeClass(health)}>{TENANT_HEALTH_LABELS[health]}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{condo.unitCount}</td>
                    <td className="px-4 py-3 text-muted">{condo.pendingInvitationCount}</td>
                    <td className="px-4 py-3 text-muted">{condo.memberCount}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(condo.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                        <Link
                          href={`/platform/condominios/${condo.id}`}
                          className="text-violet-300 hover:underline"
                        >
                          Gestionar
                        </Link>
                        <PlatformImpersonateButton condominiumId={condo.id} compact />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
