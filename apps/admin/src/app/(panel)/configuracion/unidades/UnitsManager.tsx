'use client';

import { useState, useTransition } from 'react';
import { formatUnitLabel, UNIT_KIND_LABELS } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import type { ClusterRow, UnitOccupant, UnitRow as UnitData } from '@/lib/load-condominium';

import { createCluster, createUnit, deleteCluster, deleteUnit, inviteUnitOccupant } from './actions';

export function UnitsManager({
  clusters,
  units,
}: {
  clusters: ClusterRow[];
  units: UnitData[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  const unitsByCluster = clusters.map((cluster) => ({
    cluster,
    units: units.filter((u) => u.cluster_id === cluster.id),
  }));
  const unassigned = units.filter((u) => !u.cluster_id);

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

      {message ? (
        <p className={`text-sm ${message.includes('guardados') || message.includes('Invitación') || message.includes('agregada') ? 'text-accent' : 'text-red-300'}`}>
          {message}
        </p>
      ) : null}

      {unitsByCluster.map(({ cluster, units: clusterUnits }) => (
        <GlassCard key={cluster.id}>
          <div className="mb-4 flex items-start justify-between gap-3">
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

          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Agregar unidad en {cluster.name}</h3>
            <form
              action={(fd) => run(createUnit, fd, 'Unidad agregada.')}
              className="mt-3 grid gap-3 sm:grid-cols-4"
            >
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
                <input
                  name="unit_number"
                  required
                  placeholder="Ej. 284"
                  className="glass-input mt-1"
                />
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
            <p className="mt-2 text-xs text-subtle">
              Se guardará como: {cluster.name} / Casa|Depto / número
            </p>
          </div>

          <ul className="space-y-3">
            {clusterUnits.length === 0 ? (
              <li className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Este cluster no tiene unidades. Agrega la primera casa o depto arriba.
              </li>
            ) : (
              clusterUnits.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  clusterName={cluster.name}
                  pending={pending}
                  onDelete={(fd) => run(deleteUnit, fd)}
                  onInvite={(fd) => run(inviteUnitOccupant, fd, 'Invitación enviada.')}
                />
              ))
            )}
          </ul>
        </GlassCard>
      ))}

      {unassigned.length > 0 ? (
        <GlassCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">Sin cluster</h3>
          <ul className="space-y-3">
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

function hasRegisteredPerson(unit: UnitData): boolean {
  return [unit.owner, unit.tenant, unit.resident].some((o) => o && !o.pending);
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
  const showTenant = true;

  return (
    <li className="glass-card-deep px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text)]">{label}</p>
          {unit.unit_kind ? (
            <p className="text-xs text-subtle">
              {UNIT_KIND_LABELS[unit.unit_kind]} · Coef. {unit.coefficient}
            </p>
          ) : (
            <p className="text-xs text-subtle">Coef. {unit.coefficient}</p>
          )}

          <div className="mt-3 space-y-1.5 text-sm">
            <OccupantLine label="Propietario" occupant={unit.owner ?? unit.resident} />
            {showTenant ? <OccupantLine label="Inquilino" occupant={unit.tenant} optional /> : null}
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
        {showTenant ? (
          <InviteForm
            unitId={unit.id}
            relationship="tenant"
            label="Invitar inquilino"
            disabled={pending || Boolean(unit.tenant && !unit.tenant.pending)}
            onInvite={onInvite}
          />
        ) : null}
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
      <span className="text-muted">{label}:</span>{' '}
      {occupant.name}
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
