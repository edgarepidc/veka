'use client';

import { useMemo, useState, useTransition } from 'react';
import { formatUnitLabel, UNIT_KIND_LABELS, type UnitKind } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import type { ClusterRow, UnitOccupant, UnitRow as UnitData } from '@/lib/load-condominium';

import { createCluster, createUnit, deleteCluster, deleteUnit, inviteUnitOccupant } from './actions';

export interface ClusterStats {
  total: number;
  casas: number;
  deptos: number;
  legacy: number;
  ownersRegistered: number;
  tenantsRegistered: number;
  missing: number;
}

export function computeClusterStats(units: UnitData[]): ClusterStats {
  let casas = 0;
  let deptos = 0;
  let legacy = 0;
  let ownersRegistered = 0;
  let tenantsRegistered = 0;
  let missing = 0;

  for (const unit of units) {
    if (unit.unit_kind === 'casa') casas++;
    else if (unit.unit_kind === 'depto') deptos++;
    else legacy++;

    const hasOwner = hasRegisteredOwner(unit);
    const hasTenant = hasRegisteredTenant(unit);

    if (hasOwner) ownersRegistered++;
    if (hasTenant) tenantsRegistered++;

    missing += missingPeopleForUnit(unit);
  }

  return {
    total: units.length,
    casas,
    deptos,
    legacy,
    ownersRegistered,
    tenantsRegistered,
    missing,
  };
}

function hasRegisteredOwner(unit: UnitData): boolean {
  return Boolean(
    (unit.owner && !unit.owner.pending) || (unit.resident && !unit.resident.pending),
  );
}

function hasRegisteredTenant(unit: UnitData): boolean {
  return Boolean(unit.tenant && !unit.tenant.pending);
}

function hasRegisteredPerson(unit: UnitData): boolean {
  return hasRegisteredOwner(unit) || hasRegisteredTenant(unit);
}

function missingPeopleForUnit(unit: UnitData): number {
  let count = 0;
  if (!hasRegisteredOwner(unit)) count++;
  if (unit.unit_kind === 'casa' && !hasRegisteredTenant(unit)) count++;
  return count;
}

export function UnitsManager({
  clusters,
  units,
}: {
  clusters: ClusterRow[];
  units: UnitData[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [unassignedOpen, setUnassignedOpen] = useState(false);

  const unitsByCluster = useMemo(
    () =>
      clusters.map((cluster) => ({
        cluster,
        units: units.filter((u) => u.cluster_id === cluster.id),
        stats: computeClusterStats(units.filter((u) => u.cluster_id === cluster.id)),
      })),
    [clusters, units],
  );

  const unassigned = units.filter((u) => !u.cluster_id);
  const unassignedStats = useMemo(() => computeClusterStats(unassigned), [unassigned]);

  function isClusterOpen(clusterId: string) {
    return expanded[clusterId] ?? false;
  }

  function toggleCluster(clusterId: string) {
    setExpanded((prev) => ({ ...prev, [clusterId]: !isClusterOpen(clusterId) }));
  }

  function run<T extends { error?: string; success?: boolean }>(
    action: (formData: FormData) => Promise<T>,
    formData: FormData,
    successMessage = 'Cambios guardados.',
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? successMessage);
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Nuevo cluster / torre / villa</h2>
        <p className="mt-1 text-sm text-muted">
          Ej. Torre A, Marbella, Sector Norte. Dentro de cada cluster agregas casas o deptos.
        </p>
        <form action={(fd) => run(createCluster, fd)} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input name="name" placeholder="Ej. Marbella" required className="glass-input flex-1" />
          <button type="submit" disabled={pending} className="glass-btn-primary shrink-0">
            Agregar cluster
          </button>
        </form>
      </GlassCard>

      {clusters.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setExpanded(Object.fromEntries(clusters.map((c) => [c.id, true])))
            }
            className="glass-btn-secondary text-xs"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={() => setExpanded({})}
            className="glass-btn-secondary text-xs"
          >
            Compactar todos
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-sm ${message.includes('guardados') || message.includes('Invitación') || message.includes('agregada') ? 'text-accent' : 'text-red-300'}`}
        >
          {message}
        </p>
      ) : null}

      {unitsByCluster.map(({ cluster, units: clusterUnits, stats }) => (
        <ClusterSection
          key={cluster.id}
          cluster={cluster}
          units={clusterUnits}
          stats={stats}
          open={isClusterOpen(cluster.id)}
          pending={pending}
          onToggle={() => toggleCluster(cluster.id)}
          onDeleteCluster={(fd) => run(deleteCluster, fd)}
          onCreateUnit={(fd) => run(createUnit, fd, 'Unidad agregada.')}
          onDeleteUnit={(fd) => run(deleteUnit, fd)}
          onInvite={(fd) => run(inviteUnitOccupant, fd, 'Invitación enviada.')}
        />
      ))}

      {unassigned.length > 0 ? (
        <GlassCard>
          <button
            type="button"
            onClick={() => setUnassignedOpen((v) => !v)}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass-tag-blue">Sin cluster</span>
                <ClusterStatChips stats={unassignedStats} />
              </div>
            </div>
            <Chevron open={unassignedOpen} />
          </button>

          {unassignedOpen ? (
            <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {unassigned.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  clusterName={unit.cluster?.name ?? 'Sin cluster'}
                  pending={pending}
                  onDelete={(fd) => run(deleteUnit, fd)}
                  onInvite={(fd) => run(inviteUnitOccupant, fd, 'Invitación enviada.')}
                />
              ))}
            </ul>
          ) : null}
        </GlassCard>
      ) : null}

      {clusters.length === 0 ? (
        <GlassCard deep>
          <p className="text-sm text-muted">Crea un cluster (torre, villa o sector) para empezar a agregar unidades.</p>
        </GlassCard>
      ) : null}
    </div>
  );
}

function ClusterSection({
  cluster,
  units,
  stats,
  open,
  pending,
  onToggle,
  onDeleteCluster,
  onCreateUnit,
  onDeleteUnit,
  onInvite,
}: {
  cluster: ClusterRow;
  units: UnitData[];
  stats: ClusterStats;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onDeleteCluster: (formData: FormData) => void;
  onCreateUnit: (formData: FormData) => void;
  onDeleteUnit: (formData: FormData) => void;
  onInvite: (formData: FormData) => void;
}) {
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex items-start gap-2 p-4 sm:gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left transition hover:bg-white/5"
        >
          <Chevron open={open} className="mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-[var(--text)]">{cluster.name}</span>
            </div>
            <div className="mt-2">
              <ClusterStatChips stats={stats} />
            </div>
          </div>
        </button>

        <form action={onDeleteCluster} className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <input type="hidden" name="id" value={cluster.id} />
          <button type="submit" className="glass-btn-danger text-xs">
            Eliminar
          </button>
        </form>
      </div>

      {open ? (
        <div className="border-t border-white/10 px-4 pb-4">
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Agregar unidad en {cluster.name}</h3>
            <form action={onCreateUnit} className="mt-3 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="cluster_id" value={cluster.id} />
              <label className="block text-sm text-muted sm:col-span-1">
                Tipo
                <select name="unit_kind" required defaultValue="casa" className="glass-input mt-1">
                  <option value="casa" className="bg-slate-900">
                    Casa
                  </option>
                  <option value="depto" className="bg-slate-900">
                    Depto
                  </option>
                </select>
              </label>
              <label className="block text-sm text-muted sm:col-span-1">
                Número
                <input name="unit_number" required placeholder="Ej. 284" className="glass-input mt-1" />
              </label>
              <label className="block text-sm text-muted sm:col-span-1">
                Coeficiente
                <input
                  name="coefficient"
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  defaultValue="1"
                  className="glass-input mt-1"
                />
              </label>
              <div className="flex items-end sm:col-span-1">
                <button type="submit" disabled={pending} className="glass-btn-primary w-full">
                  Agregar
                </button>
              </div>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {units.length === 0 ? (
              <li className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Este cluster no tiene unidades. Agrega la primera casa o depto arriba.
              </li>
            ) : (
              units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  clusterName={cluster.name}
                  pending={pending}
                  onDelete={onDeleteUnit}
                  onInvite={onInvite}
                />
              ))
            )}
          </ul>
        </div>
      ) : null}
    </GlassCard>
  );
}

function ClusterStatChips({ stats }: { stats: ClusterStats }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {stats.casas > 0 ? <StatChip tone="blue" label="Casas" value={stats.casas} /> : null}
      {stats.deptos > 0 ? <StatChip tone="blue" label="Deptos" value={stats.deptos} /> : null}
      {stats.legacy > 0 ? <StatChip tone="muted" label="Unidades" value={stats.legacy} /> : null}
      {stats.total === 0 ? <StatChip tone="muted" label="Sin unidades" value={0} hideZero /> : null}
      <StatChip tone="green" label="Dueños" value={stats.ownersRegistered} />
      <StatChip tone="purple" label="Inquilinos" value={stats.tenantsRegistered} />
      {stats.missing > 0 ? (
        <StatChip tone="amber" label="Por registrar" value={stats.missing} />
      ) : (
        <StatChip tone="green" label="Completo" value={0} hideZero />
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
  hideZero,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'purple' | 'amber' | 'muted';
  hideZero?: boolean;
}) {
  if (hideZero && value === 0) return null;

  const tones = {
    blue: 'border-sky-400/25 bg-sky-400/15 text-sky-200',
    green: 'border-emerald-400/25 bg-emerald-400/15 text-emerald-200',
    purple: 'border-violet-400/25 bg-violet-400/15 text-violet-200',
    amber: 'border-amber-400/35 bg-amber-400/15 text-amber-100',
    muted: 'border-white/15 bg-white/8 text-subtle',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      <span className="opacity-80">{label}</span>
      {label !== 'Completo' && label !== 'Sin unidades' ? <span>{value}</span> : null}
    </span>
  );
}

function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-subtle transition ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function UnitCard({
  unit,
  clusterName,
  pending,
  onDelete,
  onInvite,
}: {
  unit: UnitData;
  clusterName: string;
  pending: boolean;
  onDelete: (formData: FormData) => void;
  onInvite: (formData: FormData) => void;
}) {
  const label = formatUnitLabel(clusterName, unit);
  const vacant = !hasRegisteredPerson(unit);

  return (
    <li className="glass-card-deep px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text)]">{label}</p>
          {unit.unit_kind ? (
            <p className="text-xs text-subtle">
              {UNIT_KIND_LABELS[unit.unit_kind as UnitKind]} · Coef. {unit.coefficient}
            </p>
          ) : (
            <p className="text-xs text-subtle">Coef. {unit.coefficient}</p>
          )}

          <div className="mt-3 space-y-1.5 text-sm">
            <OccupantLine label="Propietario" occupant={unit.owner ?? unit.resident} />
            <OccupantLine label="Inquilino" occupant={unit.tenant} optional />
          </div>

          {vacant ? (
            <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              Sin persona registrada en esta unidad. Invita al propietario o inquilino para que acceda a la app.
            </div>
          ) : null}
        </div>

        <form action={onDelete} className="shrink-0">
          <input type="hidden" name="id" value={unit.id} />
          <button type="submit" disabled={pending} className="glass-btn-danger text-xs">
            Eliminar
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
        <InviteForm
          unitId={unit.id}
          relationship="owner"
          label="Invitar propietario"
          disabled={pending || Boolean(unit.owner && !unit.owner.pending)}
          onInvite={onInvite}
        />
        <InviteForm
          unitId={unit.id}
          relationship="tenant"
          label="Invitar inquilino"
          disabled={pending || Boolean(unit.tenant && !unit.tenant.pending)}
          onInvite={onInvite}
        />
      </div>
    </li>
  );
}

function OccupantLine({
  label,
  occupant,
  optional,
}: {
  label: string;
  occupant: UnitOccupant | null;
  optional?: boolean;
}) {
  if (!occupant) {
    return (
      <p className="text-subtle">
        <span className="text-muted">{label}:</span> {optional ? '—' : 'Sin registrar'}
      </p>
    );
  }

  return (
    <p className="text-[var(--text)]">
      <span className="text-muted">{label}:</span> {occupant.name}
      {occupant.pending ? (
        <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-200">
          Invitación pendiente{occupant.email ? ` · ${occupant.email}` : ''}
        </span>
      ) : null}
    </p>
  );
}

function InviteForm({
  unitId,
  relationship,
  label,
  disabled,
  onInvite,
}: {
  unitId: string;
  relationship: 'owner' | 'tenant';
  label: string;
  disabled?: boolean;
  onInvite: (formData: FormData) => void;
}) {
  return (
    <form action={onInvite} className="flex min-w-0 flex-1 gap-2">
      <input type="hidden" name="unit_id" value={unitId} />
      <input type="hidden" name="unit_relationship" value={relationship} />
      <input
        type="email"
        name="email"
        required
        disabled={disabled}
        placeholder="correo@ejemplo.com"
        className="glass-input min-w-0 flex-1"
      />
      <button type="submit" disabled={disabled} className="glass-btn-secondary shrink-0 text-xs">
        {label}
      </button>
    </form>
  );
}
