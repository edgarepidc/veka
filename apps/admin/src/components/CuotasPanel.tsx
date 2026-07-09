'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type {
  ChargeStatus,
  FeeCampaignStatus,
  FundType,
  RecurringFeeAmountMode,
  RecurringFeeStatus,
} from '@veka/shared';
import {
  RECURRING_FEE_AMOUNT_MODES,
  buildVariableFeeCaptureCsv,
  cardTagClass,
  currentPeriodMonth,
  defaultFeeConcept,
  defaultVariableFeeConcept,
  feeCampaignStatusLabel,
  feeScopeLabel,
  formatCurrency,
  fundTypeLabel,
  matchesFeeClusterFilter,
  matchesFinanceClusterFilter,
  nextPeriodMonth,
  parseVariableFeeCaptureCsv,
  periodLabel,
  recurringFeeAmountModeLabel,
  recurringFeeStatusLabel,
  resolveBaseAmount,
  sanitizeExportFilename,
} from '@veka/shared';

import {
  cancelFeeCampaign,
  createExtraordinaryFee,
  createRecurringFee,
  saveVariableFeePeriodAmounts,
  setRecurringFeeStatus,
  updateRecurringFee,
} from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { downloadCsv } from '@/lib/finance-export-client';
import { HELP } from '@/lib/help-content';
import { createClient } from '@/lib/supabase/client';

interface ClusterRow {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  identifier: string;
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
  amount_mode?: RecurringFeeAmountMode | null;
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


function feeScopeFromClusterFilter(clusterFilterId: string): 'general' | 'cluster' {
  return clusterFilterId ? 'cluster' : 'general';
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const tagTone =
    tone === 'amber' ? 'orange' : tone === 'neutral' ? 'gray' : tone;
  return (
    <span className={`${cardTagClass(tagTone)} px-2 py-0.5 text-xs`}>
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
  const [capturingFeeId, setCapturingFeeId] = useState<string | null>(null);
  const [capturePeriod, setCapturePeriod] = useState(currentPeriodMonth());
  const [captureAmounts, setCaptureAmounts] = useState<Record<string, string>>({});
  const [captureLoading, setCaptureLoading] = useState(false);
  const [csvImportMessage, setCsvImportMessage] = useState<string | null>(null);

  const currentPeriod = currentPeriodMonth();
  const capturePeriodOptions = useMemo(() => {
    const periods = [currentPeriod, nextPeriodMonth(currentPeriod)];
    const [y, m] = currentPeriod.split('-').map(Number);
    const prev = new Date(y!, m! - 2, 1);
    periods.unshift(
      `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`,
    );
    return periods;
  }, [currentPeriod]);

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

  const feeScope = feeScopeFromClusterFilter(clusterFilterId);
  const activeClusterName = clusters.find((cluster) => cluster.id === clusterFilterId)?.name;

  const [periodicForm, setPeriodicForm] = useState({
    amountMode: 'fixed' as RecurringFeeAmountMode,
    concept: defaultFeeConcept('general'),
    baseAmount: '3500',
    dueDay: '5',
    fundType: 'operating' as FundType,
  });

  const [extraForm, setExtraForm] = useState({
    concept: defaultFeeConcept('extraordinary'),
    amount: '5000',
    dueDate: '',
    fundType: 'operating' as FundType,
  });

  useEffect(() => {
    setPeriodicForm((prev) => ({
      ...prev,
      concept:
        prev.amountMode === 'variable'
          ? defaultVariableFeeConcept(activeClusterName)
          : clusterFilterId
            ? defaultFeeConcept('cluster', activeClusterName)
            : defaultFeeConcept('general'),
    }));
    setExtraForm((prev) => ({
      ...prev,
      concept: defaultFeeConcept('extraordinary'),
    }));
  }, [activeClusterName, clusterFilterId]);

  useEffect(() => {
    if (!capturingFeeId) return;

    let cancelled = false;
    setCaptureLoading(true);

    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('recurring_fee_period_amounts')
        .select('unit_id, amount')
        .eq('recurring_fee_id', capturingFeeId)
        .eq('period_month', capturePeriod);

      if (cancelled) return;

      if (error) {
        setMessage(error.message);
        setCaptureAmounts({});
        setCaptureLoading(false);
        return;
      }

      const next: Record<string, string> = {};
      for (const row of data ?? []) {
        if (Number(row.amount) > 0) next[row.unit_id] = String(row.amount);
      }
      setCaptureAmounts(next);
      setCaptureLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [capturePeriod, capturingFeeId]);

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

  const periodicUnitsCount = scopedUnits.length;

  const extraordinaryUnitsCount = scopedUnits.length;

  const activeRecurring = scopedRecurringFees.filter((fee) => fee.status === 'active');
  const activeExtraordinary = scopedExtraordinary.filter((campaign) => campaign.status === 'active');

  function openEdit(fee: RecurringFeeRow) {
    const baseAmount = resolveBaseAmount(fee.revisions, currentPeriod);
    setCapturingFeeId(null);
    setEditingFeeId(fee.id);
    setEditForm({
      concept: fee.concept,
      baseAmount: fee.amount_mode === 'variable' ? '' : String(baseAmount || ''),
      dueDay: String(fee.due_day),
      fundType: fee.fund_type,
    });
  }

  function openCapture(fee: RecurringFeeRow) {
    setEditingFeeId(null);
    setCapturingFeeId(fee.id);
    setCapturePeriod(currentPeriod);
    setCaptureAmounts({});
    setCsvImportMessage(null);
  }

  function downloadCaptureTemplate(fee: RecurringFeeRow, feeUnits: UnitOption[]) {
    const csv = buildVariableFeeCaptureCsv(
      feeUnits.map((unit) => ({ id: unit.id, identifier: unit.identifier })),
      captureAmounts,
    );
    const slug = sanitizeExportFilename(
      `${fee.concept}-${periodLabel(capturePeriod)}-${scopeLabel}`,
    );
    downloadCsv(`consumo-${slug}.csv`, csv);
  }

  async function handleCaptureCsvUpload(
    file: File | null,
    feeUnits: UnitOption[],
  ) {
    if (!file) return;
    setCsvImportMessage(null);
    try {
      const text = await file.text();
      const parsed = parseVariableFeeCaptureCsv(
        text,
        feeUnits.map((unit) => ({ id: unit.id, identifier: unit.identifier })),
      );

      setCaptureAmounts((prev) => ({ ...prev, ...parsed.amountsByUnitId }));

      const parts = [`${parsed.matched} unidad${parsed.matched === 1 ? '' : 'es'} cargada${parsed.matched === 1 ? '' : 's'}`];
      if (parsed.skippedEmpty > 0) parts.push(`${parsed.skippedEmpty} vacías/omitidas`);
      if (parsed.unknownUnits.length > 0) {
        parts.push(`${parsed.unknownUnits.length} unidad(es) no encontradas`);
      }
      if (parsed.invalidRows.length > 0) {
        parts.push(`${parsed.invalidRows.length} fila(s) inválida(s)`);
      }

      setCsvImportMessage(
        parsed.matched > 0 || parsed.unknownUnits.length > 0 || parsed.invalidRows.length > 0
          ? `CSV: ${parts.join(' · ')}.`
          : 'CSV sin montos válidos. Revisa la plantilla (columnas unidad,monto).',
      );
    } catch {
      setCsvImportMessage('No se pudo leer el archivo CSV.');
    }
  }

  function runCreatePeriodic(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createRecurringFee(formData);
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      const isVariable = formData.get('amount_mode') === 'variable';
      setMessage(
        isVariable
          ? 'Cuota de consumo registrada. Captura los montos del mes para emitir cargos.'
          : 'Cuota periódica registrada. Los cargos del mes se generan automáticamente.',
      );
      setPeriodicForm((prev) => ({
        ...prev,
        concept:
          prev.amountMode === 'variable'
            ? defaultVariableFeeConcept(activeClusterName)
            : clusterFilterId
              ? defaultFeeConcept('cluster', activeClusterName)
              : defaultFeeConcept('general'),
      }));
      onReload();
    });
  }

  function runSaveVariableCapture(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveVariableFeePeriodAmounts(formData);
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      const count = 'unitCount' in result ? result.unitCount : 0;
      setMessage(
        `Consumo de ${periodLabel(capturePeriod)} emitido para ${count} unidad${count === 1 ? '' : 'es'}.`,
      );
      setCapturingFeeId(null);
      onReload();
    });
  }

  function runUpdatePeriodic(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateRecurringFee(formData);
      if ('error' in result && result.error) {
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
      if ('error' in result && result.error) {
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
      <p className="text-sm text-muted">
        Alcance actual: <span className="font-medium text-[var(--text)]">{scopeLabel}</span>. Las cuotas que
        registres o emitas aplican solo a este alcance.
      </p>
      {message ? (
        <p
          className={`text-sm ${message.includes('registrada') || message.includes('actualizada') || message.includes('emitida') || message.includes('emitido') || message.includes('cancelada') || message.includes('actualizado') ? 'text-accent' : 'text-red-300'}`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <SectionHeading help={HELP.cuotas.periodica}>Cuota periódica</SectionHeading>
          <p className="mt-1 text-sm text-muted">
            Fija: monto base × coeficiente cada mes. Variable: capturas montos distintos por unidad cada
            periodo (gas, agua, etc.) en{' '}
            <span className="font-medium text-[var(--text)]">{scopeLabel}</span>.
          </p>
          <form action={runCreatePeriodic} className="mt-4 space-y-3">
            <input type="hidden" name="condominium_id" value={condominiumId} />
            <input type="hidden" name="scope" value={feeScope} />
            <input type="hidden" name="cluster_id" value={clusterFilterId} />
            <input type="hidden" name="amount_mode" value={periodicForm.amountMode} />

            <div className="flex flex-wrap gap-2">
              {RECURRING_FEE_AMOUNT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setPeriodicForm((prev) => ({
                      ...prev,
                      amountMode: mode,
                      concept:
                        mode === 'variable'
                          ? defaultVariableFeeConcept(activeClusterName)
                          : clusterFilterId
                            ? defaultFeeConcept('cluster', activeClusterName)
                            : defaultFeeConcept('general'),
                    }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    periodicForm.amountMode === mode
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[color-mix(in_srgb,var(--border)_50%,transparent)] text-muted hover:text-[var(--text)]'
                  }`}
                >
                  {recurringFeeAmountModeLabel(mode)}
                </button>
              ))}
            </div>

            <input
              name="concept"
              required
              value={periodicForm.concept}
              onChange={(e) => setPeriodicForm((prev) => ({ ...prev, concept: e.target.value }))}
              className="glass-input"
              placeholder="Concepto"
            />
            {periodicForm.amountMode === 'fixed' ? (
              <MoneyInput
                name="base_amount"
                required
                value={periodicForm.baseAmount}
                onChange={(value) => setPeriodicForm((prev) => ({ ...prev, baseAmount: value }))}
                className="w-full"
                placeholder="Monto base mensual (× coeficiente)"
              />
            ) : (
              <p className="rounded-xl bg-[color-mix(in_srgb,var(--border)_35%,transparent)] px-3 py-2 text-xs text-subtle">
                No pide monto fijo. Después de registrarla, usa &quot;Capturar mes&quot; para cargar el consumo
                por unidad y emitir los cargos.
              </p>
            )}
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
              {periodicUnitsCount === 1 ? '' : 'es'}
              {periodicForm.amountMode === 'fixed'
                ? `. Los cargos de ${periodLabel(currentPeriod)} se crean al guardar.`
                : '. Los cargos se crean al capturar el consumo del mes.'}
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
            Fijas se renuevan solas. Variables requieren captura mensual por unidad.
          </p>
          <div className="mt-4 space-y-3">
            {activeRecurring.length === 0 ? (
              <p className="text-sm text-subtle">No hay cuotas periódicas activas.</p>
            ) : (
              activeRecurring.map((fee) => {
                const isVariable = (fee.amount_mode ?? 'fixed') === 'variable';
                const baseAmount = resolveBaseAmount(fee.revisions, currentPeriod);
                const stats = recurringStats.get(fee.id) ?? { paid: 0, pending: 0, overdue: 0, total: 0 };
                const isEditing = editingFeeId === fee.id;
                const isCapturing = capturingFeeId === fee.id;
                const feeUnits = scopedUnits.filter((unit) =>
                  fee.scope === 'cluster' ? unit.cluster_id === fee.cluster_id : true,
                );
                const captureTotal = feeUnits.reduce((sum, unit) => {
                  const amount = Number(captureAmounts[unit.id] || 0);
                  return sum + (Number.isFinite(amount) ? amount : 0);
                }, 0);

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
                        {!isVariable ? (
                          <MoneyInput
                            name="base_amount"
                            required
                            value={editForm.baseAmount}
                            onChange={(value) => setEditForm((prev) => ({ ...prev, baseAmount: value }))}
                            className="w-full"
                          />
                        ) : null}
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
                        {!isVariable ? (
                          <p className="text-xs text-subtle">
                            Si ya hay cargos de {periodLabel(currentPeriod)}, el nuevo monto aplicará desde{' '}
                            {periodLabel(nextPeriodMonth(currentPeriod))}.
                          </p>
                        ) : (
                          <p className="text-xs text-subtle">
                            Los montos mensuales se capturan con &quot;Capturar mes&quot;, no aquí.
                          </p>
                        )}
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
                    ) : isCapturing ? (
                      <form action={runSaveVariableCapture} className="space-y-3">
                        <input type="hidden" name="condominium_id" value={condominiumId} />
                        <input type="hidden" name="fee_id" value={fee.id} />
                        <input type="hidden" name="period_month" value={capturePeriod} />
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--text)]">{fee.concept}</p>
                            <p className="mt-1 text-xs text-subtle">
                              Captura de consumo · {periodLabel(capturePeriod)}. Los cargos emitidos
                              aparecen en Estado de cuenta de cada unidad.
                            </p>
                          </div>
                          <label className="block text-xs">
                            <span className="mb-1 block text-subtle">Periodo</span>
                            <select
                              value={capturePeriod}
                              onChange={(e) => {
                                setCapturePeriod(e.target.value);
                                setCsvImportMessage(null);
                              }}
                              className="glass-input min-w-[10rem] text-sm"
                            >
                              {capturePeriodOptions.map((period) => (
                                <option key={period} value={period} className="bg-slate-900">
                                  {periodLabel(period)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="rounded-xl border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                            Carga masiva CSV
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Descarga la plantilla, llena la columna <code>monto</code> y súbela. Columnas:{' '}
                            <code>unidad,monto,notas</code>.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => downloadCaptureTemplate(fee, feeUnits)}
                              className="text-xs font-semibold text-accent hover:underline"
                            >
                              Descargar plantilla
                            </button>
                            <label className="cursor-pointer text-xs font-semibold text-accent hover:underline">
                              Cargar CSV
                              <input
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  void handleCaptureCsvUpload(file, feeUnits);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                          {csvImportMessage ? (
                            <p className="mt-2 text-xs text-muted">{csvImportMessage}</p>
                          ) : null}
                        </div>

                        {captureLoading ? (
                          <p className="text-sm text-subtle">Cargando montos…</p>
                        ) : (
                          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {feeUnits.map((unit) => (
                              <label
                                key={unit.id}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="text-muted">{unit.identifier}</span>
                                <MoneyInput
                                  name={`amount_${unit.id}`}
                                  value={captureAmounts[unit.id] ?? ''}
                                  onChange={(value) =>
                                    setCaptureAmounts((prev) => ({ ...prev, [unit.id]: value }))
                                  }
                                  className="w-32"
                                  placeholder="0"
                                />
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-subtle">
                            Total capturado:{' '}
                            <span className="font-semibold text-[var(--text)]">
                              {formatCurrency(captureTotal)}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button type="submit" disabled={pending || captureLoading} className="glass-btn-primary text-sm">
                              {pending ? 'Emitiendo…' : 'Guardar y emitir cargos'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCapturingFeeId(null)}
                              className="text-sm text-muted hover:underline"
                            >
                              Cerrar
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--text)]">{fee.concept}</p>
                            <p className="mt-1 text-xs text-subtle">
                              {recurringFeeAmountModeLabel(isVariable ? 'variable' : 'fixed')}
                              {' · '}
                              {feeScopeLabel(fee.scope)}
                              {fee.cluster?.name ? ` · ${fee.cluster.name}` : ''}
                              {' · '}
                              {isVariable
                                ? 'Monto por unidad / mes'
                                : `${formatCurrency(baseAmount)} base / unidad`}
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
                          {isVariable ? (
                            <button
                              type="button"
                              onClick={() => openCapture(fee)}
                              className="text-accent hover:underline"
                            >
                              Capturar mes
                            </button>
                          ) : null}
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
          <SectionHeading help={HELP.cuotas.extraordinaria}>Cuota extraordinaria</SectionHeading>
          <p className="mt-1 text-sm text-muted">
            Emisión única con fecha de vencimiento específica para{' '}
            <span className="font-medium text-[var(--text)]">{scopeLabel}</span>.
          </p>
          <form action={runCreateExtraordinary} className="mt-4 space-y-3">
            <input type="hidden" name="condominium_id" value={condominiumId} />
            <input type="hidden" name="cluster_id" value={clusterFilterId} />
            <input
              name="concept"
              required
              value={extraForm.concept}
              onChange={(e) => setExtraForm((prev) => ({ ...prev, concept: e.target.value }))}
              className="glass-input"
              placeholder="Concepto"
            />
            <MoneyInput
              name="amount"
              required
              value={extraForm.amount}
              onChange={(value) => setExtraForm((prev) => ({ ...prev, amount: value }))}
              className="w-full"
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
