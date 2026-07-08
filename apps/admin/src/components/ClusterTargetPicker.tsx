'use client';

import { useState } from 'react';

import type { ClusterOption } from '@/lib/community-clusters';

export function ClusterTargetPicker({ clusters }: { clusters: ClusterOption[] }) {
  const [allClusters, setAllClusters] = useState(true);

  if (clusters.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-sm font-medium text-[var(--text)]">Alcance</p>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={allClusters}
          onChange={(event) => setAllClusters(event.target.checked)}
          className="rounded border-white/20"
        />
        Todo el fraccionamiento
      </label>
      <input type="hidden" name="scope_mode" value={allClusters ? 'all' : 'clusters'} />
      {!allClusters ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {clusters.map((cluster) => (
            <label key={cluster.id} className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="cluster_ids"
                value={cluster.id}
                className="rounded border-white/20"
              />
              {cluster.name}
            </label>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-subtle">
        Puedes elegir una o más torres. Si no seleccionas ninguna torre específica, todos los residentes
        verán la publicación.
      </p>
    </div>
  );
}
