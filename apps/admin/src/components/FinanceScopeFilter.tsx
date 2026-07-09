'use client';

import type { IconType } from 'react-icons';
import {
  IoBusiness,
  IoBusinessOutline,
  IoLayers,
  IoLayersOutline,
} from 'react-icons/io5';

interface CondominiumOption {
  id: string;
  name: string;
}

interface ClusterOption {
  id: string;
  name: string;
}

function ScopeChip({
  active,
  label,
  icon: Icon,
  iconActive: IconActive,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: IconType;
  iconActive: IconType;
  onClick: () => void;
}) {
  const ChipIcon = active ? IconActive : Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]'
          : 'border-[var(--border)] text-muted hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:text-[var(--text)]'
      }`}
    >
      <ChipIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export function FinanceScopeFilter({
  condominiums,
  clusters,
  condominiumId,
  clusterId,
  onCondominiumChange,
  onClusterChange,
  align = 'end',
}: {
  condominiums: CondominiumOption[];
  clusters: ClusterOption[];
  condominiumId: string;
  clusterId: string;
  onCondominiumChange: (id: string) => void;
  onClusterChange: (id: string) => void;
  align?: 'start' | 'end';
}) {
  const showCondominium = condominiums.length > 1;
  const chipAlign = align === 'end' ? 'justify-end' : 'justify-start';

  return (
    <div className="space-y-2">
      {showCondominium ? (
        <div className={`flex flex-wrap items-center gap-2 ${chipAlign}`}>
          <select
            value={condominiumId}
            onChange={(e) => onCondominiumChange(e.target.value)}
            className="glass-input glass-input-compact min-w-[180px]"
          >
            {condominiums.map((condo) => (
              <option key={condo.id} value={condo.id} className="bg-slate-900">
                {condo.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className={`flex flex-wrap gap-2 ${chipAlign}`}>
        <ScopeChip
          active={clusterId === ''}
          label="Todo el condominio"
          icon={IoBusinessOutline}
          iconActive={IoBusiness}
          onClick={() => onClusterChange('')}
        />
        {clusters.map((cluster) => (
          <ScopeChip
            key={cluster.id}
            active={clusterId === cluster.id}
            label={cluster.name}
            icon={IoLayersOutline}
            iconActive={IoLayers}
            onClick={() => onClusterChange(cluster.id)}
          />
        ))}
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
