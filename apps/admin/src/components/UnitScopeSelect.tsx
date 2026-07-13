'use client';

import { useMemo, useState } from 'react';
import { matchesClusterResourceScope } from '@veka/shared';

export interface UnitScopeOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
  cluster: { name: string } | null;
}

export function UnitScopeSelect({
  units,
  scopeFilter,
  name = 'unit_id',
  required = true,
}: {
  units: UnitScopeOption[];
  scopeFilter: string;
  name?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const scopeKey = scopeFilter || 'all';
    const scoped = units.filter((unit) =>
      matchesClusterResourceScope(unit.cluster_id, scopeKey),
    );
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((unit) => unit.identifier.toLowerCase().includes(needle));
  }, [query, scopeFilter, units]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: UnitScopeOption[] }>();
    for (const unit of filtered) {
      const key = unit.cluster_id ?? 'all';
      const label = unit.cluster?.name ?? 'Todo el condominio';
      const group = map.get(key) ?? { label, items: [] };
      group.items.push(unit);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [filtered]);

  return (
    <div className="grid gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar unidad…"
        className="glass-input"
      />
      <select name={name} required={required} defaultValue="" className="glass-input">
        <option value="" disabled className="bg-slate-900">
          Selecciona unidad
        </option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label} className="bg-slate-900">
            {group.items.map((unit) => (
              <option key={unit.id} value={unit.id} className="bg-slate-900">
                {unit.identifier}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {filtered.length === 0 ? (
        <p className="text-xs text-subtle">No hay unidades en este alcance o búsqueda.</p>
      ) : null}
    </div>
  );
}
