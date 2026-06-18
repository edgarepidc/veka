'use client';

interface CondominiumOption {
  id: string;
  name: string;
}

interface ClusterOption {
  id: string;
  name: string;
}

export function FinanceScopeFilter({
  condominiums,
  clusters,
  condominiumId,
  clusterId,
  onCondominiumChange,
  onClusterChange,
  compact = false,
}: {
  condominiums: CondominiumOption[];
  clusters: ClusterOption[];
  condominiumId: string;
  clusterId: string;
  onCondominiumChange: (id: string) => void;
  onClusterChange: (id: string) => void;
  compact?: boolean;
}) {
  const showCondominium = condominiums.length > 1;

  return (
    <div className={`flex flex-wrap items-end gap-2 ${compact ? '' : 'w-full'}`}>
      {showCondominium ? (
        <div className={compact ? '' : 'min-w-[200px] flex-1'}>
          {!compact ? (
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-subtle">
              Condominio
            </label>
          ) : null}
          <select
            value={condominiumId}
            onChange={(e) => onCondominiumChange(e.target.value)}
            className="glass-input w-full min-w-[180px]"
          >
            {condominiums.map((condo) => (
              <option key={condo.id} value={condo.id} className="bg-slate-900">
                {condo.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className={compact ? '' : 'min-w-[200px] flex-1'}>
        {!compact ? (
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-subtle">
            Torre / cluster
          </label>
        ) : null}
        <select
          value={clusterId}
          onChange={(e) => onClusterChange(e.target.value)}
          className="glass-input w-full min-w-[180px]"
        >
          <option value="" className="bg-slate-900">
            Todo el condominio
          </option>
          {clusters.map((cluster) => (
            <option key={cluster.id} value={cluster.id} className="bg-slate-900">
              {cluster.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function FinanceClusterField({
  clusters,
  name = 'cluster_id',
  defaultValue = '',
}: {
  clusters: ClusterOption[];
  name?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-subtle">Alcance (torre / cluster)</label>
      <select name={name} defaultValue={defaultValue} className="glass-input">
        <option value="" className="bg-slate-900">
          Todo el condominio
        </option>
        {clusters.map((cluster) => (
          <option key={cluster.id} value={cluster.id} className="bg-slate-900">
            {cluster.name}
          </option>
        ))}
      </select>
    </div>
  );
}
