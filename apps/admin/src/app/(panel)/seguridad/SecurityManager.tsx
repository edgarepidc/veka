'use client';

import { matchesClusterResourceScope } from '@veka/shared';
import { useMemo, useState } from 'react';

import { FinanceScopeFilter } from '@/components/FinanceScopeFilter';
import { PackageRegisterPanel } from '@/components/PackageRegisterPanel';
import { SecurityOpsPanels } from '@/components/SecurityOpsPanels';
import { SecuritySettingsPanel } from '@/components/SecuritySettingsPanel';
import { VisitCheckInPanel } from '@/components/VisitCheckInPanel';
import { GlassCard } from '@/components/ui/GlassCard';
import type { SecuritySettings } from '@veka/shared';
import type {
  ClusterOption,
  PackageRow,
  SecurityUnitOption,
  VisitRow,
} from '@/lib/load-seguridad';

type Tab = 'validar' | 'paquetes' | 'operaciones' | 'politicas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'validar', label: 'Validar pase' },
  { id: 'paquetes', label: 'Paquetes' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'politicas', label: 'Políticas' },
];

function unitClusterId(unit: { cluster_id: string | null } | null | undefined): string | null {
  return unit?.cluster_id ?? null;
}

export function SecurityManager({
  condominiumId,
  visits,
  packages,
  units,
  clusters,
  securitySettings,
  canEditSettings,
}: {
  condominiumId: string;
  visits: VisitRow[];
  packages: PackageRow[];
  units: SecurityUnitOption[];
  clusters: ClusterOption[];
  securitySettings: SecuritySettings;
  canEditSettings: boolean;
}) {
  const [tab, setTab] = useState<Tab>('validar');
  const [scopeFilter, setScopeFilter] = useState('');

  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) =>
        matchesClusterResourceScope(unitClusterId(visit.unit), scopeFilter || 'all'),
      ),
    [scopeFilter, visits],
  );

  const filteredPackages = useMemo(
    () =>
      packages.filter((pkg) =>
        matchesClusterResourceScope(unitClusterId(pkg.unit), scopeFilter || 'all'),
      ),
    [packages, scopeFilter],
  );

  return (
    <div className="space-y-3">
      <GlassCard className="!p-3">
        <div className="glass-tab-strip">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {clusters.length > 0 ? (
          <div className="mt-3">
            <FinanceScopeFilter
              condominiums={[{ id: condominiumId, name: 'Condominio' }]}
              clusters={clusters}
              condominiumId={condominiumId}
              clusterId={scopeFilter}
              onCondominiumChange={() => {}}
              onClusterChange={setScopeFilter}
              align="end"
              allLabel="Todo"
            />
          </div>
        ) : null}
      </GlassCard>

      {tab === 'validar' ? <VisitCheckInPanel condominiumId={condominiumId} /> : null}

      {tab === 'paquetes' ? (
        <PackageRegisterPanel
          condominiumId={condominiumId}
          units={units}
          scopeFilter={scopeFilter}
        />
      ) : null}

      {tab === 'operaciones' ? (
        <SecurityOpsPanels visits={filteredVisits} packages={filteredPackages} />
      ) : null}

      {tab === 'politicas' ? (
        <SecuritySettingsPanel
          condominiumId={condominiumId}
          settings={securitySettings}
          canEdit={canEditSettings}
        />
      ) : null}

      <GlassCard variant="muted">
        <h2 className="text-sm font-semibold text-[var(--text)]">Cómo funciona</h2>
        <p className="mt-2 text-sm text-muted">
          El residente genera el pase en la app. En caseta escanea el QR o ingresa la referencia; el sistema
          valida vigencia y registra el ingreso. Los chips de torre filtran paquetes, unidades y la bitácora
          del día.
        </p>
      </GlassCard>
    </div>
  );
}
