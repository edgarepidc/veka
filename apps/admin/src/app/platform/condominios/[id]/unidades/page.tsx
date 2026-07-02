import { formatUnitLabel } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { loadPlatformClustersAndUnits } from '@/lib/load-platform-data';

function occupantLabel(
  occupant: { name: string; email?: string; pending?: boolean } | null,
): string {
  if (!occupant) return '—';
  const base = occupant.name;
  if (occupant.pending) return `${base} (invitado)`;
  return base;
}

export default async function PlatformCondominioUnidadesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { clusters, units } = await loadPlatformClustersAndUnits(id);

  if (clusters.length === 0 && units.length === 0) {
    return (
      <GlassCard>
        <p className="text-sm text-subtle">Este condominio aún no tiene clusters ni unidades registradas.</p>
      </GlassCard>
    );
  }

  const unitsByCluster = new Map<string, typeof units>();
  for (const cluster of clusters) {
    unitsByCluster.set(cluster.id, units.filter((unit) => unit.cluster_id === cluster.id));
  }

  return (
    <div className="space-y-4">
      {clusters.map((cluster) => {
        const clusterUnits = unitsByCluster.get(cluster.id) ?? [];
        return (
          <GlassCard key={cluster.id} className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold text-[var(--text)]">{cluster.name}</h2>
              <p className="text-xs text-subtle">{clusterUnits.length} unidades</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Propietario</th>
                  <th className="px-4 py-2">Inquilino</th>
                  <th className="px-4 py-2">Coef.</th>
                </tr>
              </thead>
              <tbody>
                {clusterUnits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-subtle">
                      Sin unidades en este cluster.
                    </td>
                  </tr>
                ) : (
                  clusterUnits.map((unit) => (
                    <tr key={unit.id} className="border-t border-white/5">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">
                        {formatUnitLabel(cluster.name, unit)}
                      </td>
                      <td className="px-4 py-3 text-muted">{occupantLabel(unit.owner ?? unit.resident)}</td>
                      <td className="px-4 py-3 text-muted">{occupantLabel(unit.tenant)}</td>
                      <td className="px-4 py-3 text-muted">{unit.coefficient}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        );
      })}
    </div>
  );
}
