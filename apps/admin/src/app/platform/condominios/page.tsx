import Link from 'next/link';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformCondominiums } from '@/lib/load-platform-data';

export default async function PlatformCondominiosPage() {
  const condominiums = await loadPlatformCondominiums();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Condominios"
          highlight="en Veka"
          subtitle="Todos los tenants registrados. Entra a cada uno para ver usuarios y asignar administradores."
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
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Usuarios</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {condominiums.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                  No hay condominios todavía.
                </td>
              </tr>
            ) : (
              condominiums.map((condo) => (
                <tr key={condo.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{condo.name}</td>
                  <td className="px-4 py-3 text-muted">{condo.organization?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{condo.memberCount}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(condo.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/platform/condominios/${condo.id}`} className="text-violet-300 hover:underline">
                      Gestionar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
