'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  formatUnitLabel,
  UNIT_KIND_LABELS,
  UNIT_RELATIONSHIP_CHIP_LABELS,
  UNIT_RELATIONSHIP_LABELS,
  type UnitKind,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { StatChip } from '@/components/ui/StatChip';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';
import type { ClusterRow, UnitOccupant, UnitRow as UnitData } from '@/lib/load-condominium';

import { createCluster, createUnit, deleteCluster, deleteUnit, registerUnitOccupant } from './actions';

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
  return Boolean((unit.owner && !unit.owner.pending) || (unit.resident && !unit.resident.pending));
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

function isSuccessMessage(message: string): boolean {
  return (
    message.includes('guardados') ||
    message.includes('agregada') ||
    message.includes('registrad') ||
    message.includes('creada')
  );
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
    <div className="space-y-3">
      <GlassCard>
        <SectionHeading help={HELP.unidades}>Nuevo cluster / torre / villa</SectionHeading>
        <p className="mt-1 text-sm text-muted">
          Ej. Torre A, Marbella, Sector Norte. Dentro de cada cluster agregas casas o deptos y registras
          residentes.
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
            onClick={() => setExpanded(Object.fromEntries(clusters.map((c) => [c.id, true])))}
            className="glass-btn-secondary text-xs"
          >
            Expandir todos
          </button>
          <button type="button" onClick={() => setExpanded({})} className="glass-btn-secondary text-xs">
            Compactar todos
          </button>
        </div>
      ) : null}

      {message ? (
        <p className={`text-sm ${isSuccessMessage(message) ? 'text-accent' : 'text-red-300'}`}>{message}</p>
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
          onRegister={(fd) => run(registerUnitOccupant, fd, 'Persona registrada.')}
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
                  onRegister={(fd) => run(registerUnitOccupant, fd, 'Persona registrada.')}
                />
              ))}
            </ul>
          ) : null}
        </GlassCard>
      ) : null}

      {clusters.length === 0 ? (
        <GlassCard deep>
          <p className="text-sm text-muted">
            Crea un cluster (torre, villa o sector) para empezar a agregar unidades.
          </p>
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
  onRegister,
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
  onRegister: (formData: FormData) => void;
}) {
  const [showTenantOnCreate, setShowTenantOnCreate] = useState(false);

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
            <form
              action={(fd) => {
                onCreateUnit(fd);
                setShowTenantOnCreate(false);
              }}
              className="mt-3 space-y-4"
            >
              <input type="hidden" name="cluster_id" value={cluster.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-muted">
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
                <label className="block text-sm text-muted">
                  Número
                  <input name="unit_number" required placeholder="Ej. 284" className="glass-input mt-1" />
                </label>
              </div>

              <PersonFields prefix="owner" title="Propietario (opcional)" />

              {showTenantOnCreate ? (
                <PersonFields prefix="tenant" title="Inquilino (opcional)" />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTenantOnCreate(true)}
                  className="glass-btn-secondary text-xs"
                >
                  Agregar inquilino
                </button>
              )}

              <button type="submit" disabled={pending} className="glass-btn-primary">
                Agregar unidad
              </button>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {units.length === 0 ? (
              <li className="glass-notice-amber text-sm">
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
                  onRegister={onRegister}
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
      <StatChip tone="green" label={UNIT_RELATIONSHIP_CHIP_LABELS.owner} value={stats.ownersRegistered} />
      <StatChip tone="purple" label={UNIT_RELATIONSHIP_CHIP_LABELS.tenant} value={stats.tenantsRegistered} />
      {stats.missing > 0 ? (
        <StatChip tone="amber" label="Por registrar" value={stats.missing} />
      ) : (
        <StatChip tone="green" label="Completo" value={0} hideZero />
      )}
    </div>
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
  onRegister,
}: {
  unit: UnitData;
  clusterName: string;
  pending: boolean;
  onDelete: (formData: FormData) => void;
  onRegister: (formData: FormData) => void;
}) {
  const label = formatUnitLabel(clusterName, unit);
  const vacant = !hasRegisteredPerson(unit);
  const ownerReady = hasRegisteredOwner(unit);
  const tenantReady = hasRegisteredTenant(unit);
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [showTenantForm, setShowTenantForm] = useState(false);

  return (
    <li className="glass-card-deep px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text)]">{label}</p>
          {unit.unit_kind ? (
            <p className="text-xs text-subtle">{UNIT_KIND_LABELS[unit.unit_kind as UnitKind]}</p>
          ) : null}

          <div className="mt-3 space-y-1.5 text-sm">
            <OccupantLine label={UNIT_RELATIONSHIP_LABELS.owner} occupant={unit.owner ?? unit.resident} />
            <OccupantLine label={UNIT_RELATIONSHIP_LABELS.tenant} occupant={unit.tenant} optional />
          </div>

          {vacant ? (
            <div className="glass-notice-amber mt-3 px-3 py-2 text-xs">
              Sin persona registrada. Puedes dejar la vivienda vacía o registrar propietario / inquilino con
              acceso a la app.
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

      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <p className="text-xs text-subtle">
          Ambos perfiles tienen permisos de residente. Solo las votaciones formales en Comunidad están
          reservadas al propietario. La persona cambia su contraseña después en su perfil.
        </p>

        {!ownerReady ? (
          showOwnerForm ? (
            <RegisterOccupantForm
              unitId={unit.id}
              relationship="owner"
              title={`Registrar ${UNIT_RELATIONSHIP_LABELS.owner.toLowerCase()}`}
              pending={pending}
              onRegister={onRegister}
              onCancel={() => setShowOwnerForm(false)}
            />
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowOwnerForm(true)}
              className="glass-btn-secondary text-xs"
            >
              Registrar propietario
            </button>
          )
        ) : null}

        {!tenantReady ? (
          showTenantForm ? (
            <RegisterOccupantForm
              unitId={unit.id}
              relationship="tenant"
              title={`Registrar ${UNIT_RELATIONSHIP_LABELS.tenant.toLowerCase()}`}
              pending={pending}
              onRegister={onRegister}
              onCancel={() => setShowTenantForm(false)}
            />
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowTenantForm(true)}
              className="glass-btn-secondary text-xs"
            >
              Agregar inquilino
            </button>
          )
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
      <span className="text-muted">{label}:</span> {occupant.name}
      {occupant.email ? <span className="text-subtle"> · {occupant.email}</span> : null}
      {occupant.pending ? (
        <span className="glass-tag-amber ml-2 px-2 py-0.5 text-xs">Invitación pendiente</span>
      ) : null}
    </p>
  );
}

function PersonFields({ prefix, title }: { prefix: string; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 text-xs text-subtle">Déjalo en blanco si lo registrarás después.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          name={`${prefix}_full_name`}
          placeholder="Nombre completo"
          className="glass-input sm:col-span-2"
          autoComplete="off"
        />
        <input
          type="email"
          name={`${prefix}_email`}
          placeholder="correo@ejemplo.com"
          className="glass-input"
          autoComplete="off"
        />
        <input
          type="tel"
          name={`${prefix}_phone`}
          placeholder="Teléfono"
          className="glass-input"
          autoComplete="off"
        />
        <input
          type="password"
          name={`${prefix}_password`}
          placeholder="Contraseña (mín. 8)"
          className="glass-input sm:col-span-2"
          autoComplete="new-password"
        />
      </div>
    </div>
  );
}

function RegisterOccupantForm({
  unitId,
  relationship,
  title,
  pending,
  onRegister,
  onCancel,
}: {
  unitId: string;
  relationship: 'owner' | 'tenant';
  title: string;
  pending: boolean;
  onRegister: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      action={(fd) => {
        onRegister(fd);
        onCancel();
      }}
      className="rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <input type="hidden" name="unit_id" value={unitId} />
      <input type="hidden" name="unit_relationship" value={relationship} />
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          name="full_name"
          required
          placeholder="Nombre completo"
          className="glass-input sm:col-span-2"
          autoComplete="off"
        />
        <input
          type="email"
          name="email"
          required
          placeholder="correo@ejemplo.com"
          className="glass-input"
          autoComplete="off"
        />
        <input type="tel" name="phone" placeholder="Teléfono" className="glass-input" autoComplete="off" />
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="Contraseña (mín. 8)"
          className="glass-input sm:col-span-2"
          autoComplete="new-password"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="glass-btn-primary text-xs">
          Guardar acceso
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className="glass-btn-secondary text-xs">
          Cancelar
        </button>
      </div>
    </form>
  );
}
