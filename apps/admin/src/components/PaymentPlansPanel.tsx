'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ChargeStatus } from '@veka/shared';
import {
  chargeBalanceDue,
  formatCurrency,
  installmentBalanceDue,
  installmentStatusLabel,
  paymentPlanStatusLabel,
  planInstallmentsProgress,
} from '@veka/shared';

import { cancelPaymentPlan, createPaymentPlan } from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';

interface UnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
}

interface ChargeRow {
  id: string;
  unit_id: string;
  concept: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  status: ChargeStatus | string;
}

interface InstallmentRow {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  amount_paid?: number;
  status: string;
}

export interface PaymentPlanRow {
  id: string;
  title: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  unit_id: string;
  unit: { identifier: string; cluster_id: string | null } | null;
  installments: InstallmentRow[];
}

export function PaymentPlansPanel({
  condominiumId,
  units,
  charges,
  plans,
  onReload,
}: {
  condominiumId: string;
  units: UnitOption[];
  charges: ChargeRow[];
  plans: PaymentPlanRow[];
  onReload: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [title, setTitle] = useState('Plan de pago');
  const [notes, setNotes] = useState('');
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([]);

  const unitCharges = useMemo(
    () =>
      charges.filter(
        (charge) =>
          charge.unit_id === unitId &&
          chargeBalanceDue({
            amount: Number(charge.amount),
            amount_paid: Number(charge.amount_paid ?? 0),
            status: charge.status,
          }) > 0,
      ),
    [charges, unitId],
  );

  const selectedTotal = useMemo(
    () =>
      unitCharges
        .filter((charge) => selectedChargeIds.includes(charge.id))
        .reduce(
          (sum, charge) =>
            sum +
            chargeBalanceDue({
              amount: Number(charge.amount),
              amount_paid: Number(charge.amount_paid ?? 0),
              status: charge.status,
            }),
          0,
        ),
    [selectedChargeIds, unitCharges],
  );

  const activePlans = plans.filter((plan) => plan.status === 'active');
  const historyPlans = plans.filter((plan) => plan.status !== 'active');

  function toggleCharge(chargeId: string) {
    setSelectedChargeIds((prev) =>
      prev.includes(chargeId) ? prev.filter((id) => id !== chargeId) : [...prev, chargeId],
    );
  }

  function handleUnitChange(nextUnitId: string) {
    setUnitId(nextUnitId);
    const defaults = charges
      .filter(
        (charge) =>
          charge.unit_id === nextUnitId &&
          chargeBalanceDue({
            amount: Number(charge.amount),
            amount_paid: Number(charge.amount_paid ?? 0),
            status: charge.status,
          }) > 0,
      )
      .map((charge) => charge.id);
    setSelectedChargeIds(defaults);
  }

  function runCreate(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createPaymentPlan(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Plan de pago creado.');
      setUnitId('');
      setSelectedChargeIds([]);
      onReload();
    });
  }

  function handleCancel(planId: string) {
    if (!confirm('¿Cancelar este plan de pago? Las parcialidades pendientes quedarán canceladas.')) return;
    setMessage(null);
    startTransition(async () => {
      const result = await cancelPaymentPlan(planId, condominiumId);
      setMessage(result.error ?? 'Plan cancelado.');
      onReload();
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SectionHeading help={HELP.planes}>Planes de pago</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Acuerda pagos en parcialidades sobre cargos vencidos. Los abonos se aplican a los cargos
              vinculados en orden de antigüedad.
            </p>
          </div>
          <div className="glass-tab-strip inline-flex shrink-0" role="group">
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              className={`glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs ${createOpen ? 'glass-tab-active' : ''}`}
            >
              {createOpen ? 'Ocultar formulario' : 'Nuevo plan'}
            </button>
          </div>
        </div>

        {createOpen ? (
        <form action={runCreate} className="mt-4 space-y-3">
          <input type="hidden" name="condominium_id" value={condominiumId} />
          <input type="hidden" name="unit_id" value={unitId} />
          {selectedChargeIds.map((chargeId) => (
            <input key={chargeId} type="hidden" name="charge_id" value={chargeId} />
          ))}

          <select
            required
            value={unitId}
            onChange={(e) => handleUnitChange(e.target.value)}
            className="glass-input"
          >
            <option value="" className="bg-slate-900">
              Selecciona unidad
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id} className="bg-slate-900">
                {unit.identifier}
              </option>
            ))}
          </select>

          {unitId ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Cargos incluidos</p>
              <ul className="mt-2 space-y-2">
                {unitCharges.length === 0 ? (
                  <li className="text-sm text-subtle">Sin cargos pendientes en esta unidad.</li>
                ) : (
                  unitCharges.map((charge) => {
                    const balance = chargeBalanceDue({
                      amount: Number(charge.amount),
                      amount_paid: Number(charge.amount_paid ?? 0),
                      status: charge.status,
                    });
                    return (
                      <li key={charge.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedChargeIds.includes(charge.id)}
                          onChange={() => toggleCharge(charge.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium text-[var(--text)]">{charge.concept}</span>
                          <span className="text-subtle">
                            {' '}
                            · vence {charge.due_date} · {formatCurrency(balance)}
                          </span>
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
              {selectedChargeIds.length > 0 ? (
                <p className="mt-2 text-sm text-accent">
                  Total del plan: <span className="font-semibold">{formatCurrency(selectedTotal)}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input"
              placeholder="Título del plan"
            />
            <input
              name="installment_count"
              type="number"
              min={2}
              max={36}
              required
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
              className="glass-input"
              placeholder="Número de parcialidades"
            />
            <input
              name="first_due_date"
              type="date"
              required
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="glass-input"
            />
            <select
              name="interval_months"
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)}
              className="glass-input"
            >
              <option value="1" className="bg-slate-900">Cada mes</option>
              <option value="2" className="bg-slate-900">Cada 2 meses</option>
              <option value="3" className="bg-slate-900">Cada 3 meses</option>
            </select>
          </div>

          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="glass-input min-h-20"
            placeholder="Notas internas (opcional)"
          />

          <button
            type="submit"
            disabled={pending || !unitId || selectedChargeIds.length === 0}
            className="glass-btn-primary disabled:opacity-60"
          >
            {pending ? 'Creando…' : 'Crear plan de pago'}
          </button>
        </form>
        ) : null}

        {message ? (
          <p
            className={`mt-3 text-sm ${message.includes('creado') || message.includes('cancelado') ? 'text-accent' : 'text-red-300'}`}
          >
            {message}
          </p>
        ) : null}
      </GlassCard>

      <GlassCard>
        <h3 className="text-base font-semibold text-[var(--text)]">Planes activos</h3>
        {activePlans.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No hay planes activos.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {activePlans.map((plan) => {
              const progress = planInstallmentsProgress(plan.installments);
              return (
                <div key={plan.id} className="glass-card-deep p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text)]">
                        {plan.title} · {plan.unit?.identifier ?? 'Unidad'}
                      </p>
                      <p className="text-sm text-subtle">
                        {paymentPlanStatusLabel(plan.status)} · {formatCurrency(Number(plan.total_amount))}
                        {progress.percent !== null ? ` · ${progress.percent}% cubierto` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(plan.id)}
                      disabled={pending}
                      className="glass-btn px-3 py-1.5 text-xs font-semibold text-amber-100"
                    >
                      Cancelar plan
                    </button>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-subtle">
                          <th className="px-2 py-1">#</th>
                          <th className="px-2 py-1">Vence</th>
                          <th className="px-2 py-1 text-right">Monto</th>
                          <th className="px-2 py-1 text-right">Pagado</th>
                          <th className="px-2 py-1">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.installments
                          .sort((a, b) => a.installment_number - b.installment_number)
                          .map((installment) => (
                            <tr key={installment.id} className="border-t border-white/5">
                              <td className="px-2 py-2">{installment.installment_number}</td>
                              <td className="px-2 py-2 text-muted">{installment.due_date}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(Number(installment.amount))}</td>
                              <td className="px-2 py-2 text-right text-accent">
                                {formatCurrency(installmentBalanceDue(installment) > 0
                                  ? Number(installment.amount_paid ?? 0)
                                  : Number(installment.amount))}
                              </td>
                              <td className="px-2 py-2">{installmentStatusLabel(installment.status)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {historyPlans.length > 0 ? (
        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Historial</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {historyPlans.map((plan) => (
              <li key={plan.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2">
                <span>
                  {plan.title} · {plan.unit?.identifier}
                </span>
                <span className="text-subtle">
                  {paymentPlanStatusLabel(plan.status)} · {formatCurrency(Number(plan.total_amount))}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </div>
  );
}
