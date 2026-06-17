'use client';

import { useState, useTransition } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import type { ClusterRow, UnitRow as UnitData } from '@/lib/load-condominium';

import { createCluster, createUnit, deleteCluster, deleteUnit } from './actions';

export function UnitsManager({
  clusters,
  units,
}: {
  clusters: ClusterRow[];
  units: UnitData[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>, formData: FormData) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? 'Cambios guardados.');
    });
  }

  const unitsByCluster = clusters.map((cluster) => ({
    cluster,
    units: units.filter((u) => u.cluster_id === cluster.id),
  }));
  const unassigned = units.filter((u) => !u.cluster_id);

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Nuevo cluster / torre</h2>
        <form action={(fd) => run(createCluster, fd)} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input name="name" placeholder="Ej. Torre C" required className="glass-input flex-1" />
          <button type="submit" disabled={pending} className="glass-btn-primary shrink-0">
            Agregar cluster
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Nueva unidad</h2>
        <form action={(fd) => run(createUnit, fd)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="identifier" placeholder="Ej. C-301" required className="glass-input" />
          <select name="cluster_id" className="glass-input" defaultValue="">
            <option value="" className="bg-slate-900">
              Sin cluster
            </option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900">
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="coefficient"
            type="number"
            step="0.000001"
            min="0.000001"
            defaultValue="1"
            placeholder="Coeficiente"
            className="glass-input"
          />
          <button type="submit" disabled={pending} className="glass-btn-primary sm:col-span-2">
            Agregar unidad
          </button>
        </form>
      </GlassCard>

      {message ? (
        <p className={`text-sm ${message.includes('guardados') ? 'text-accent' : 'text-red-300'}`}>{message}</p>
      ) : null}

      {unitsByCluster.map(({ cluster, units: clusterUnits }) => (
        <GlassCard key={cluster.id}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className="glass-tag-blue">{cluster.name}</span>
              <p className="mt-2 text-sm text-subtle">{clusterUnits.length} unidad(es)</p>
            </div>
            <form action={(fd) => run(deleteCluster, fd)}>
              <input type="hidden" name="id" value={cluster.id} />
              <button type="submit" className="glass-btn-danger text-xs">
                Eliminar cluster
              </button>
            </form>
          </div>
          <ul className="space-y-2">
            {clusterUnits.length === 0 ? (
              <li className="text-sm text-subtle">Sin unidades en este cluster.</li>
            ) : (
              clusterUnits.map((unit) => <UnitListItem key={unit.id} unit={unit} onDelete={run} pending={pending} />)
            )}
          </ul>
        </GlassCard>
      ))}

      {unassigned.length > 0 ? (
        <GlassCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">Sin cluster</h3>
          <ul className="space-y-2">
            {unassigned.map((unit) => (
              <UnitListItem key={unit.id} unit={unit} onDelete={run} pending={pending} />
            ))}
          </ul>
        </GlassCard>
      ) : null}

      {clusters.length === 0 && units.length === 0 ? (
        <GlassCard deep>
          <p className="text-sm text-muted">Aún no hay clusters ni unidades. Crea el primero arriba.</p>
        </GlassCard>
      ) : null}
    </div>
  );
}

function UnitListItem({
  unit,
  onDelete,
  pending,
}: {
  unit: UnitData;
  onDelete: (action: typeof deleteUnit, formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <li className="glass-card-deep flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="font-semibold text-[var(--text)]">{unit.identifier}</p>
        <p className="text-xs text-subtle">Coef. {unit.coefficient}</p>
      </div>
      <form action={(fd) => onDelete(deleteUnit, fd)}>
        <input type="hidden" name="id" value={unit.id} />
        <button type="submit" disabled={pending} className="glass-btn-danger text-xs">
          Eliminar
        </button>
      </form>
    </li>
  );
}
