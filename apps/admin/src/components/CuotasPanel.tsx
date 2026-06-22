'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ChargeStatus, FeeCampaignStatus, FundType, RecurringFeeStatus } from '@veka/shared';
import {
  currentPeriodMonth,
  defaultFeeConcept,
  feeCampaignStatusLabel,
  feeScopeLabel,
  formatCurrency,
  fundTypeLabel,
  matchesFeeClusterFilter,
  matchesFinanceClusterFilter,
  nextPeriodMonth,
  periodLabel,
  recurringFeeStatusLabel,
  resolveBaseAmount,
} from '@veka/shared';

import {
  cancelFeeCampaign,
  createExtraordinaryFee,
  createRecurringFee,
  setRecurringFeeStatus,
  updateRecurringFee,
} from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';

interface ClusterRow {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  cluster_id: string | null;
}

interface ChargeRow {
  status: ChargeStatus;
  fee_campaign_id: string | null;
  recurring_fee_id: string | null;
  unit?: { cluster_id: string | null } | null;
}

interface RecurringFeeRow {
  id: string;
  scope: 'general' | 'cluster';
  cluster_id: string | null;
  concept: string;
  due_day: number;
  fund_type: FundType;
  status: RecurringFeeStatus;
  cluster: { name: string } | null;
  revisions: { base_amount: number; effective_from: string }[];
}

interface ExtraordinaryCampaignRow {
  id: string;
  cluster_id: string | null;
  concept: string;
  amount: number;
  due_date: string;
  fund_type: FundType;
  status: FeeCampaignStatus;
  cluster: { name: string } | null;
}

const PERIODIC_SCOPES = ['general', 'cluster'] as const;

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-300'
        : tone === 'red'
          ? 'bg-red-500/15 text-red-300'
          : 'bg-white/10 text-muted';
  return (
    <span className={`rounded-lg px-2 py-1 ${toneClass}`}>
      {label}: <span className="font-semibold">{value}</span>
    </span>
  );
}

export function CuotasPanel({
  condominiumId,
  clusters,
  units,
  recurringFees,
  extraordinaryCampaigns,
  charges,
  clusterFilterId,
  scopeLabel,
  onReload,
}: {
  condominiumId: string;
  clusters: ClusterRow[];
  units: UnitOption[];
  recurringFees: RecurringFeeRow[];
  extraordinaryCampaigns: ExtraordinaryCampaignRow[];
  charges: ChargeRow[];
  clusterFilterId: string;
  scopeLabel: string;
  onReload: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);

  const currentPeriod = currentPeriodMonth();

  const scopedUnits = useMemo(() => {
    if (!clusterFilterId) return units;
    return units.filter((unit) => unit.cluster_id === clusterFilterId);
  }, [clusterFilterId, units]);

  const scopedCharges = useMemo(
    () =>
      charges.filter((charge) =>
        matchesFinanceClusterFilter(charge.unit?.cluster_id, clusterFilterId, { condoWideApplies: false }),
      ),
    [charges, clusterFilterId],
  );

  const scopedRecurringFees = useMemo(
    () =>
      recurringFees.filter((fee) =>
        matchesFeeClusterFilter(fee.scope, fee.cluster_id, clusterFilterId),
      ),
    [clusterFilterId, recurringFees],
  );

  const scopedExtraordinary = useMemo(
    () =>
      extraordinaryCampaigns.filter((campaign) =>
        matchesFinanceClusterFilter(campaign.cluster_id, clusterFilterId, { condoWideApplies: true }),
      ),
    [clusterFilterId, extraordinaryCampaigns],
  );

  const [periodicForm, setPeriodicForm] = useState({
    scope: 'general' as 'general' | 'cluster',
    clusterId: '',
    concept: defaultFeeConcept('general'),
    baseAmount: '3500',
    dueDay: '5',
    fundType: 'operating' as FundType,
  });

  const [extraForm, setExtraForm] = useState({
    clusterId: '',
    concept: defaultFeeConcept('extraordinary'),
    amount: '5000',
    dueDate: '',
    fundType: 'operating' as FundType,
  });

  const [editForm, setEditForm] = useState({
    concept: '',
    baseAmount: '',
    dueDay: '5',
    fundType: 'operating' as FundType,
  });

  const recurringStats = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; overdue: number; total: number }>();
    for (const charge of scopedCharges) {
      if (!charge.recurring_fee_id) continue;
      const stats = map.get(charge.recurring_fee_id) ?? { paid: 0, pending: 0, overdue: 0, total: 0 };
      stats.total += 1;
      if (charge.status === 'paid') stats.paid += 1;
      else if (charge.status === 'overdue') stats.overdue += 1;
      else if (charge.status === 'pending') stats.pending += 1;
      map.set(charge.recurring_fee_id, stats);
    }
    return map;
  }, [scopedCharges]);

  const extraordinaryStats = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; overdue: number; total: number }>();
    for (const charge of scopedCharges) {
      if (!charge.fee_campaign_id) continue;
      const stats = map.get(charge.fee_campaign_id) ?? { paid: 0, pending: 0, overdue: 0, total: 0 };
      stats.total += 1;
      if (charge.status === 'paid') stats.paid += 1;
      else if (charge.status === 'overdue') stats.overdue += 1;
      else if (charge.status === 'pending') stats.pending += 1;
      map.set(charge.fee_campaign_id, stats);
    }
    return map;
  }, [scopedCharges]);

  const periodicUnitsCount = useMemo(() => {
    if (periodicForm.scope === 'cluster') {
      if (!periodicForm.clusterId) return 0;
      return scopedUnits.filter((unit) => unit.cluster_id === periodicForm.clusterId).length;
    }
    return scopedUnits.length;
  }, [periodicForm.clusterId, periodicForm.scope, scopedUnits]);

  const extraordinaryUnitsCount = useMemo(() => {
    if (!extraForm.clusterId) return scopedUnits.length;
    return scopedUnits.filter((unit) => unit.cluster_id === extraForm.clusterId).length;
  }, [extraForm.clusterId, scopedUnits]);

  const activeRecurring = scopedRecurringFees.filter((fee) => fee.status === 'active');
  const activeExtraordinary = scopedExtraordinary.filter((campaign) => campaign.status === 'active');

  function openEdit(fee: RecurringFeeRow) {
    const baseAmount = resolveBaseAmount(fee.revisions, currentPeriod);
    setEditingFeeId(fee.id);
    setEditForm({
      concept: fee.concept,
      baseAmount: String(baseAmount),
      dueDay: String(fee.due_day),
      fundType: fee.fund_type,
    });
  }

  function runCreatePeriodic(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createRecurringFee(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Cuota periódica registrada. Los cargos del mes se generan automáticamente.');
      setPeriodicForm((prev) => ({
        ...prev,
        concept: defaultFeeConcept(prev.scope, clusters.find((c) => c.id === prev.clusterId)?.name),
      }));
      onReload();
    });
  }

  function runUpdatePeriodic(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateRecurringFee(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const from = 'effectiveFrom' in result ? result.effectiveFrom : undefined;
      setMessage(
        from
          ? `Cuota actualizada. El nuevo monto aplica desde ${periodLabel(from)}.`
          : 'Cuota actualizada.',
      );
      setEditingFeeId(null);
      onReload();
    });
  }

  function runCreateExtraordinary(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createExtraordinaryFee(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const count = 'unitCount' in result ? result.unitCount : 0;
      setMessage(`Cuota extraordinaria emitida para ${count} unidad${count === 1 ? '' : 'es'}.`);
      setExtraForm((prev) => ({ ...prev, concept: defaultFeeConcept('extraordinary'), dueDate: '' }));
      onReload();
    });
  }

  function handleRecurringStatus(feeId: string, status: RecurringFeeStatus) {
    const label =
      status === 'paused' ? 'pausar' : status === 'cancelled' ? 'cancelar' : 'reactivar';
    if (!confirm(`¿Deseas ${label} esta cuota periódica?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await setRecurringFeeStatus(feeId, status, condominiumId);
      setMessage(result.error ?? 'Estado actualizado.');
      onReload();
    });
  }

  function handleCancelExtraordinary(campaignId: string) {
    if (!confirm('¿Cancelar esta cuota extraordinaria? Se cancelarán los cargos pendientes.')) return;
    setMessage(null);
    startTransition(async () => {
      const result = await cancelFeeCampaign(campaignId, condominiumId);
      setMessage(result.error ?? 'Cuota extraordinaria cancelada.');
      onReload();
    });
  }

  return (
    <div className="space-y-8">
      {clusterFilterId ? (
        <p className="text-sm text-muted">
          Mostrando cuotas del alcance: <span className="font-medium text-[var(--text)]">{scopeLabel}</span>
        </p>
      ) : null}
      {message ? (
        <p
          className={`text-sm ${message.includes('registrada') || message.includes('actualizada') || message.includes('emitida') || message.includes('cancelada') || message.includes('actualizado') ? 'text-accent' : 'text-red-300'}`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Cuota periódica</h2>
          <p className="mt-1 text-sm text-muted">
            Regístrala una vez: se repite cada mes en el día que elijas. El monto base se multiplica por el
            coeficiente de cada unidad.
          </p>
          <form action={runCreatePeriodic} className="mt-4 space-y-3">
            <input type="hidden" name="condominium_id" value={condominiumId} />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Alcance</p>
              <div className="flex flex-wrap gap-2">
                {PERIODIC_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() =>
                      setPeriodicForm((prev) => ({
                        ...prev,
                        scope,
                        clusterId: scope === 'general' ? '' : prev.clusterId,
                        concept: defaultFeeConcept(
                          scope,
                          clusters.find((c) => c.id === prev.clusterId)?.name,
                        ),
                      }))
                    }
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      periodicForm.scope === scope
                        ? 'bg-emerald-500/20 text-accent ring-1 ring-emerald-400/40'
                        : 'bg-white/5 text-muted hover:bg-white/10'
                    }`}
                  >
                    {feeScopeLabel(scope)}
                  </button>
                ))}
              </div>
              <input type="hidden" name="scope" value={periodicForm.scope} />
            </div>

            {periodicForm.scope === 'cluster' ? (
              <select
                name="cluster_id"
                required
                value={periodicForm.clusterId}
                onChange={(e) =>
                  setPeriodicForm((prev) => ({
                    ...prev,
                    clusterId: e.target.value,
                    concept: defaultFeeConcept('cluster', clusters.find((c) => c.id === e.target.value)?.name),
                  }))
                }
                className="glass-input"
              >
                <option value="">Selecciona torre / cluster</option>
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id} className="bg-slate-900">
                    {cluster.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="cluster_id" value="" />
            )}

            <input
              name="concept"
              required
              value={periodicForm.concept}
              onChange={(e) => setPeriodicForm((prev) => ({ ...prev, concept: e.target.value }))}
              className="glass-input"
              placeholder="Concepto"
            />
            <input
              name="base_amount"
              required
              type="number"
              min="0"
              step="0.01"
              value={periodicForm.baseAmount}
              onChange={(e) => setPeriodicForm((prev) => ({ ...prev, baseAmount: e.target.value }))}
              className="glass-input"
              placeholder="Monto base mensual (× coeficiente)"
            />
            <div>
              <label className="mb-1 block text-xs text-subtle">Día de vencimiento cada mes</label>
              <select
                name="due_day"
                required
                value={periodicForm.dueDay}
                onChange={(e) => setPeriodicForm((prev) => ({ ...prev, dueDay: e.target.value }))}
                className="glass-input"
              >
                {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day} className="bg-slate-900">
                    Día {day}
                  </option>
                ))}
              </select>
            </div>
            <select
              name="fund_type"
              value={periodicForm.fundType}
              onChange={(e) =>
                setPeriodicForm((prev) => ({ ...prev, fundType: e.target.value as FundType }))
              }
              className="glass-input"
            >
              <option value="operating" className="bg-slate-900">
                {fundTypeLabel('operating')}
              </option>
              <option value="reserve" className="bg-slate-900">
                {fundTypeLabel('reserve')}
              </option>
            </select>
            <p className="text-xs text-subtle">
              Aplica a{' '}
              <span className="font-semibold text-[var(--text)]">{periodicUnitsCount}</span> unidad
              {periodicUnitsCount === 1 ? '' : 'es'}. Los cargos de {periodLabel(currentPeriod)} se crean al
              guardar.
            </p>
            <button
              type="submit"
              disabled={pending || periodicUnitsCount === 0}
              className="glass-btn-primary"
            >
              {pending ? 'Guardando…' : 'Registrar cuota periódica'}
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Cuotas periódicas activas</h2>
          <p className="mt-1 text-sm text-muted">
            Se renuevan automáticamente cada mes. Edita el monto para aplicarlo en periodos futuros.
          </p>
          <div className="mt-4 space-y-3">
            {activeRecurring.length === 0 ? (
              <p className="text-sm text-subtle">No hay cuotas periódicas activas.</p>
            ) : (
              activeRecurring.map((fee) => {
                const baseAmount = resolveBaseAmount(fee.revisions, currentPeriod);
                const stats = recurringStats.get(fee.id) ?? { paid: 0, pending: 0, overdue: 0, total: 0 };
                const isEditing = editingFeeId === fee.id;
                return (
                  <div key={fee.id} className="glass-card-deep p-4">
                    {isEditing ? (
                      <form action={runUpdatePeriodic} className="space-y-3">
                        <input type="hidden" name="condominium_id" value={condominiumId} />
                        <input type="hidden" name="fee_id" value={fee.id} />
                        <input
                          name="concept"
                          required
                          value={editForm.concept}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, concept: e.target.value }))}
                          className="glass-input"
                        />
                        <input
                          name="base_amount"
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.baseAmount}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, baseAmount: e.target.value }))}
                          className="glass-input"
                        />
                        <select
                          name="due_day"
                          required
                          value={editForm.dueDay}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, dueDay: e.target.value }))}
                          className="glass-input"
                        >
                          {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                            <option key={day} value={day} className="bg-slate-900">
                              Día {day}
                            </option>
                          ))}
                        </select>
                        <select
                          name="fund_type"
                          value={editForm.fundType}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, fundType: e.target.value as FundType }))
                          }
                          className="glass-input"
                        >
                          <option value="operating" className="bg-slate-900">
                            {fundTypeLabel('operating')}
                          </option>
                          <option value="reserve" className="bg-slate-900">
                            {fundTypeLabel('reserve')}
                          </option>
                        </select>
                        <p className="text-xs text-subtle">
                          Si ya hay cargos de {periodLabel(currentPeriod)}, el nuevo monto aplicará desde{' '}
                          {periodLabel(nextPeriodMonth(currentPeriod))}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" disabled={pending} className="glass-btn-primary text-sm">
                            Guardar cambios
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFeeId(null)}
                            className="text-sm text-muted hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--text)]">{fee.concept}</p>
                            <p className="mt-1 text-xs text-subtle">
                              {feeScopeLabel(fee.scope)}
                              {fee.cluster?.name ? ` · ${fee.cluster.name}` : ''}
                              {' · '}
                              {formatCurrency(baseAmount)} base / unidad
                              {' · '}
                              Vence día {fee.due_day} de cada mes
                            </p>
                          </div>
                          <span className="glass-tag-green">{recurringFeeStatusLabel(fee.status)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <StatChip label="Este mes" value={stats.total} tone="neutral" />
                          <StatChip label="Pagadas" value={stats.paid} tone="green" />
                          <StatChip label="Pendientes" value={stats.pending} tone="amber" />
                          {stats.overdue > 0 ? (
                            <StatChip label="Vencidas" value={stats.overdue} tone="red" />
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => openEdit(fee)}
                            className="text-accent hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRecurringStatus(fee.id, 'paused')}
                            className="text-amber-300 hover:underline"
                          >
                            Pausar
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRecurringStatus(fee.id, 'cancelled')}
                            className="text-red-300 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {scopedRecurringFees.some((fee) => fee.status !== 'active') ? (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Historial</p>
              <ul className="space-y-2">
                {scopedRecurringFees
                  .filter((fee) => fee.status !== 'active')
                  .map((fee) => (
                    <li key={fee.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-subtle">
                      <span>
                        {fee.concept} · {recurringFeeStatusLabel(fee.status)}
                      </span>
                      {fee.status === 'paused' ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleRecurringStatus(fee.id, 'active')}
                          className="text-xs text-accent hover:underline"
                        >
                          Reactivar
                        </button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Cuota extraordinaria</h2>
          <p className="mt-1 text-sm text-muted">
            Emisión única para todo el condominio o una torre, con fecha de vencimiento específica.
          </p>
          <form action={runCreateExtraordinary} className="mt-4 space-y-3">
            <input type="hidden" name="condominium_id" value={condominiumId} />
            <select
              name="cluster_id"
              value={extraForm.clusterId}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, clusterId: e.target.value }))}
              className="glass-input"
            >
              <option value="" className="bg-slate-900">
                Todo el condominio
              </option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id} className="bg-slate-900">
                  Solo {cluster.name}
                </option>
              ))}
            </select>
            <input
              name="concept"
              required
              value={extraForm.concept}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, concept: e.target.value }))}
              className="glass-input"
              placeholder="Concepto"
            />
            <input
              name="amount"
              required
              type="number"
              min="0"
              step="0.01"
              value={extraForm.amount}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="glass-input"
              placeholder="Monto base por unidad (× coeficiente)"
            />
            <input
              name="due_date"
              required
              type="date"
              value={extraForm.dueDate}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="glass-input"
            />
            <select
              name="fund_type"
              value={extraForm.fundType}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, fundType: e.target.value as FundType }))}
              className="glass-input"
            >
              <option value="operating" className="bg-slate-900">
                {fundTypeLabel('operating')}
              </option>
              <option value="reserve" className="bg-slate-900">
                {fundTypeLabel('reserve')}
              </option>
            </select>
            <p className="text-xs text-subtle">
              Se emitirá a{' '}
              <span className="font-semibold text-[var(--text)]">{extraordinaryUnitsCount}</span> unidad
              {extraordinaryUnitsCount === 1 ? '' : 'es'}.
            </p>
            <button
              type="submit"
              disabled={pending || extraordinaryUnitsCount === 0}
              className="glass-btn-primary"
            >
              {pending ? 'Emitiendo…' : 'Emitir cuota extraordinaria'}
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Cuotas extraordinarias activas</h2>
          <div className="mt-4 space-y-3">
            {activeExtraordinary.length === 0 ? (
              <p className="text-sm text-subtle">No hay cuotas extraordinarias activas.</p>
            ) : (
              activeExtraordinary.map((campaign) => {
                const stats = extraordinaryStats.get(campaign.id) ?? {
                  paid: 0,
                  pending: 0,
                  overdue: 0,
                  total: 0,
                };
                return (
                  <div key={campaign.id} className="glass-card-deep p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{campaign.concept}</p>
                        <p className="mt-1 text-xs text-subtle">
                          Extraordinaria
                          {campaign.cluster?.name ? ` · ${campaign.cluster.name}` : ' · Todo el condominio'}
                          {' · '}
                          {formatCurrency(Number(campaign.amount))} base / unidad
                          {' · '}
                          Vence {campaign.due_date}
                        </p>
                      </div>
                      <span className="glass-tag-green">{feeCampaignStatusLabel(campaign.status)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <StatChip label="Unidades" value={stats.total} tone="neutral" />
                      <StatChip label="Pagadas" value={stats.paid} tone="green" />
                      <StatChip label="Pendientes" value={stats.pending} tone="amber" />
                      {stats.overdue > 0 ? (
                        <StatChip label="Vencidas" value={stats.overdue} tone="red" />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleCancelExtraordinary(campaign.id)}
                      className="mt-3 text-xs text-red-300 hover:underline"
                    >
                      Cancelar cuota
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
