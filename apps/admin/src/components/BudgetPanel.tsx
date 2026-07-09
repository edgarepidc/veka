'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { FundType, ReserveBudgetMode, ReserveIncomeBase } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  FUND_TYPES,
  INCOME_CATEGORIES,
  RESERVE_BUDGET_MODES,
  RESERVE_EXPENSE_CATEGORIES,
  RESERVE_INCOME_BASES,
  buildBudgetSummary,
  computePercentReserveContribution,
  expenseCategoryLabel,
  findAnnualBudget,
  formatCurrency,
  fundTypeLabel,
  incomeCategoryLabel,
  resolveReserveBudgetLines,
  reserveBudgetModeLabel,
  reserveExpenseCategoryLabel,
  reserveIncomeBaseLabel,
  sumOperatingIncomeBudget,
} from '@veka/shared';

import { saveAnnualBudget } from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';

interface BudgetLineRow {
  id?: string;
  line_kind: 'expense' | 'income';
  category: string;
  annual_amount: number;
}

interface AnnualBudgetRow {
  id: string;
  fiscal_year: number;
  fund_type: FundType;
  cluster_id?: string | null;
  notes: string | null;
  reserve_mode?: ReserveBudgetMode | null;
  reserve_percent?: number | null;
  reserve_income_base?: ReserveIncomeBase | null;
  lines: BudgetLineRow[];
}

function currentYear(): number {
  return new Date().getFullYear();
}

function emptyAmounts(categories: readonly string[]): Record<string, string> {
  return Object.fromEntries(categories.map((category) => [category, '']));
}

interface ExpenseForBudgetPanel {
  amount: number;
  category: string;
  expense_date: string;
  status: string;
  fund_type: FundType;
  cluster_id: string | null;
}

interface IncomeForBudgetPanel {
  amount: number;
  category: string;
  income_date: string;
  fund_type?: FundType;
  cluster_id: string | null;
}

interface PaymentForBudgetPanel {
  amount: number;
  status: string;
  paid_at?: string | null;
  created_at?: string;
  unit?: { cluster_id: string | null } | null;
  charge?: {
    charge_kind?: string;
    fund_type?: FundType;
    fee_campaign?: { scope: string } | null;
    recurring_fee?: { scope: string } | null;
  } | null;
}

function BudgetExecutionBar({
  label,
  actual,
  budget,
  percent,
  tone,
}: {
  label: string;
  actual: number;
  budget: number;
  percent: number | null;
  tone: 'expense' | 'income';
}) {
  const used = percent ?? (budget > 0 ? Math.round((actual / budget) * 100) : 0);
  const width = Math.min(Math.max(used, 0), 100);
  const over = used > 100;
  const barColor =
    tone === 'expense'
      ? over
        ? 'bg-red-500'
        : 'bg-[var(--accent)]'
      : over
        ? 'bg-[var(--accent-3)]'
        : 'bg-[var(--accent)]';

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text)]">
            {formatCurrency(actual)}{' '}
            <span className="font-normal text-muted">/ {formatCurrency(budget)}</span>
          </p>
        </div>
        <p
          className={`text-lg font-bold tabular-nums ${over ? (tone === 'expense' ? 'text-red-500' : 'text-[var(--accent-3)]') : 'text-accent'}`}
        >
          {budget > 0 ? `${used}%` : '—'}
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: budget > 0 ? `${width}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function BudgetPanel({
  condominiumId,
  budgets,
  clusterFilterId,
  scopeLabel,
  expenses,
  incomeEntries,
  payments,
  onReload,
}: {
  condominiumId: string;
  budgets: AnnualBudgetRow[];
  clusterFilterId: string;
  scopeLabel: string;
  expenses: ExpenseForBudgetPanel[];
  incomeEntries: IncomeForBudgetPanel[];
  payments: PaymentForBudgetPanel[];
  onReload: () => void;
}) {
  const [fiscalYear, setFiscalYear] = useState(String(currentYear()));
  const [fundType, setFundType] = useState<FundType>('operating');
  const [reserveMode, setReserveMode] = useState<ReserveBudgetMode>('percent');
  const [reservePercent, setReservePercent] = useState('20');
  const [reserveIncomeBase, setReserveIncomeBase] = useState<ReserveIncomeBase>('total');
  const [notes, setNotes] = useState('');
  const [expenseAmounts, setExpenseAmounts] = useState<Record<string, string>>(() =>
    emptyAmounts(EXPENSE_CATEGORIES),
  );
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>(() =>
    emptyAmounts(INCOME_CATEGORIES),
  );
  const [reserveExpenseAmounts, setReserveExpenseAmounts] = useState<Record<string, string>>(() =>
    emptyAmounts(RESERVE_EXPENSE_CATEGORIES),
  );
  const [reserveIncomeAmount, setReserveIncomeAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startSave] = useTransition();

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return [y - 1, y, y + 1];
  }, []);

  const operatingBudget = useMemo(
    () => findAnnualBudget(budgets, Number(fiscalYear), 'operating', clusterFilterId),
    [budgets, clusterFilterId, fiscalYear],
  );

  const existing = useMemo(
    () => findAnnualBudget(budgets, Number(fiscalYear), fundType, clusterFilterId),
    [budgets, clusterFilterId, fiscalYear, fundType],
  );

  const effectiveReserveLines = useMemo(() => {
    if (fundType !== 'reserve') return [];
    return resolveReserveBudgetLines(
      existing
        ? {
            fund_type: 'reserve',
            reserve_mode: reserveMode,
            reserve_percent: Number(reservePercent) || 0,
            reserve_income_base: reserveIncomeBase,
            lines: existing.lines,
          }
        : {
            fund_type: 'reserve',
            reserve_mode: reserveMode,
            reserve_percent: Number(reservePercent) || 0,
            reserve_income_base: reserveIncomeBase,
            lines: [],
          },
      operatingBudget?.lines ?? [],
    );
  }, [existing, fundType, operatingBudget?.lines, reserveIncomeBase, reserveMode, reservePercent]);

  const operatingIncomeBase = useMemo(
    () => sumOperatingIncomeBudget(operatingBudget?.lines ?? [], reserveIncomeBase),
    [operatingBudget?.lines, reserveIncomeBase],
  );

  const percentContribution = useMemo(() => {
    const percent = Number(reservePercent);
    if (!Number.isFinite(percent)) return 0;
    return computePercentReserveContribution(operatingBudget?.lines ?? [], percent, reserveIncomeBase);
  }, [operatingBudget?.lines, reserveIncomeBase, reservePercent]);

  const reserveComponentsExpenseTotal = useMemo(
    () =>
      RESERVE_EXPENSE_CATEGORIES.reduce((sum, category) => {
        const amount = Number(reserveExpenseAmounts[category] || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [reserveExpenseAmounts],
  );

  useEffect(() => {
    if (fundType !== 'reserve') {
      const nextExpenses = emptyAmounts(EXPENSE_CATEGORIES);
      const nextIncome = emptyAmounts(INCOME_CATEGORIES);
      for (const line of existing?.lines ?? []) {
        const value = line.annual_amount > 0 ? String(line.annual_amount) : '';
        if (line.line_kind === 'expense') nextExpenses[line.category] = value;
        if (line.line_kind === 'income') nextIncome[line.category] = value;
      }
      setExpenseAmounts(nextExpenses);
      setIncomeAmounts(nextIncome);
      setNotes(existing?.notes ?? '');
      return;
    }

    setReserveMode(existing?.reserve_mode ?? 'percent');
    setReservePercent(
      existing?.reserve_percent != null ? String(existing.reserve_percent) : '20',
    );
    setReserveIncomeBase(existing?.reserve_income_base ?? 'total');
    setNotes(existing?.notes ?? '');

    const nextReserveExpenses = emptyAmounts(RESERVE_EXPENSE_CATEGORIES);
    let nextReserveIncome = '';
    for (const line of existing?.lines ?? []) {
      const value = line.annual_amount > 0 ? String(line.annual_amount) : '';
      if (line.line_kind === 'expense') nextReserveExpenses[line.category] = value;
      if (line.line_kind === 'income' && line.category === 'aportacion') nextReserveIncome = value;
    }
    setReserveExpenseAmounts(nextReserveExpenses);
    setReserveIncomeAmount(nextReserveIncome);
  }, [existing, fundType]);

  const expenseTotal = useMemo(
    () =>
      EXPENSE_CATEGORIES.reduce((sum, category) => {
        const amount = Number(expenseAmounts[category] || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [expenseAmounts],
  );

  const incomeTotal = useMemo(
    () =>
      INCOME_CATEGORIES.reduce((sum, category) => {
        const amount = Number(incomeAmounts[category] || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [incomeAmounts],
  );

  const budgetLinesForSummary = useMemo(() => {
    if (fundType === 'reserve') return effectiveReserveLines;
    return existing?.lines ?? [];
  }, [effectiveReserveLines, existing?.lines, fundType]);

  const budgetSummary = useMemo(() => {
    const scopedExpenses = clusterFilterId
      ? expenses.filter((row) => row.cluster_id === clusterFilterId)
      : expenses;
    const scopedIncome = clusterFilterId
      ? incomeEntries.filter((row) => row.cluster_id === clusterFilterId)
      : incomeEntries;
    const scopedPayments = clusterFilterId
      ? payments.filter((row) => row.unit?.cluster_id === clusterFilterId)
      : payments;

    return buildBudgetSummary({
      fiscalYear: Number(fiscalYear),
      periodMode: 'year',
      month: new Date().getMonth() + 1,
      fundType,
      budgetLines: budgetLinesForSummary,
      expenses: scopedExpenses,
      incomeEntries: scopedIncome,
      payments: scopedPayments,
    });
  }, [
    budgetLinesForSummary,
    clusterFilterId,
    expenses,
    fiscalYear,
    fundType,
    incomeEntries,
    payments,
  ]);

  function handleSave() {
    setMessage(null);
    const formData = new FormData();
    formData.set('fiscal_year', fiscalYear);
    formData.set('condominium_id', condominiumId);
    formData.set('fund_type', fundType);
    formData.set('cluster_id', clusterFilterId);
    formData.set('notes', notes);

    if (fundType === 'reserve') {
      formData.set('reserve_mode', reserveMode);
      if (reserveMode === 'percent') {
        formData.set('reserve_percent', reservePercent);
        formData.set('reserve_income_base', reserveIncomeBase);
      } else {
        for (const category of RESERVE_EXPENSE_CATEGORIES) {
          formData.set(`expense_${category}`, reserveExpenseAmounts[category] ?? '');
        }
        const incomeValue =
          reserveIncomeAmount ||
          (reserveComponentsExpenseTotal > 0 ? String(reserveComponentsExpenseTotal) : '');
        formData.set('income_aportacion', incomeValue);
      }
    } else {
      for (const category of EXPENSE_CATEGORIES) {
        formData.set(`expense_${category}`, expenseAmounts[category] ?? '');
      }
      for (const category of INCOME_CATEGORIES) {
        formData.set(`income_${category}`, incomeAmounts[category] ?? '');
      }
    }

    startSave(async () => {
      const result = await saveAnnualBudget(formData);
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Presupuesto guardado.');
      onReload();
    });
  }

  const isReserve = fundType === 'reserve';
  const isReservePercent = isReserve && reserveMode === 'percent';
  const isReserveComponents = isReserve && reserveMode === 'components';

  return (
    <div className="space-y-4">
      <GlassCard className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--text)]">Presupuesto vs real (año en curso)</h3>
          <p className="text-xs text-muted">{scopeLabel}</p>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <BudgetExecutionBar
            label={isReserve ? 'Gastos de capital' : 'Egresos'}
            actual={budgetSummary.totalExpenseActual}
            budget={budgetSummary.totalExpenseBudget}
            percent={budgetSummary.expensePercentUsed}
            tone="expense"
          />
          <BudgetExecutionBar
            label={isReserve ? 'Aportaciones' : 'Ingresos'}
            actual={budgetSummary.totalIncomeActual}
            budget={budgetSummary.totalIncomeBudget}
            percent={budgetSummary.incomePercentUsed}
            tone="income"
          />
        </div>
        {budgetSummary.proratedNote ? (
          <p className="mt-3 text-xs text-subtle">{budgetSummary.proratedNote}</p>
        ) : null}
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionHeading help={HELP.presupuesto}>Presupuesto anual</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Presupuesto independiente para{' '}
              <span className="font-medium text-[var(--text)]">{scopeLabel}</span>.
              {isReserve
                ? ' El fondo de reserva financia reemplazos mayores; puedes definirlo como % del operativo o por componentes.'
                : ' Define montos anuales por categoría.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Año fiscal</span>
              <select
                value={fiscalYear}
                onChange={(event) => setFiscalYear(event.target.value)}
                className="glass-input min-w-[7rem]"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Fondo</span>
              <select
                value={fundType}
                onChange={(event) => setFundType(event.target.value as FundType)}
                className="glass-input min-w-[9rem]"
              >
                {FUND_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {fundTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {isReserve ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {RESERVE_BUDGET_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setReserveMode(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    reserveMode === mode
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[color-mix(in_srgb,var(--border)_50%,transparent)] text-muted hover:text-[var(--text)]'
                  }`}
                >
                  {reserveBudgetModeLabel(mode)}
                </button>
              ))}
            </div>

            {isReservePercent ? (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-4">
                <p className="text-sm text-muted">
                  Calcula el aporte anual a reserva como porcentaje de los ingresos presupuestados del fondo de
                  operación ({scopeLabel}, {fiscalYear}).
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-subtle">Porcentaje anual</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={reservePercent}
                      onChange={(event) => setReservePercent(event.target.value)}
                      className="glass-input w-full"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-subtle">Base de cálculo</span>
                    <select
                      value={reserveIncomeBase}
                      onChange={(event) =>
                        setReserveIncomeBase(event.target.value as ReserveIncomeBase)
                      }
                      className="glass-input w-full"
                    >
                      {RESERVE_INCOME_BASES.map((base) => (
                        <option key={base} value={base}>
                          {reserveIncomeBaseLabel(base)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--border)_35%,transparent)] p-3">
                    <p className="text-xs text-subtle">Base operativa</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                      {operatingBudget ? formatCurrency(operatingIncomeBase) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--border)_35%,transparent)] p-3">
                    <p className="text-xs text-subtle">Aporte anual calculado</p>
                    <p className="mt-1 text-lg font-semibold text-accent">
                      {operatingBudget ? formatCurrency(percentContribution) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--border)_35%,transparent)] p-3">
                    <p className="text-xs text-subtle">Referencia mensual</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                      {operatingBudget ? formatCurrency(percentContribution / 12) : '—'}
                    </p>
                  </div>
                </div>
                {!operatingBudget ? (
                  <p className="mt-3 text-sm text-amber-500">
                    Primero guarda el presupuesto de operación del mismo año y alcance.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-subtle">
                    Referencia de mercado: 15–25% en edificios nuevos, 25–40% con más de 15 años. Revisa cada 2–3
                    años o con un estudio de vida útil.
                  </p>
                )}
              </div>
            ) : null}

            {isReserveComponents ? (
              <p className="text-sm text-muted">
                Presupuesta reemplazos mayores por componente. La aportación anual debe cubrir al menos los gastos
                de capital planeados.
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-4 text-sm ${message.includes('guardado') ? 'text-emerald-300' : 'text-red-300'}`}
          >
            {message}
          </p>
        ) : null}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-subtle">Notas (opcional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="glass-input w-full resize-y"
            placeholder="Aprobado en asamblea, supuestos, etc."
          />
        </label>
      </GlassCard>

      {!isReserve ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--text)]">Egresos presupuestados</h3>
              <span className="text-sm font-semibold text-accent">{formatCurrency(expenseTotal)}</span>
            </div>
            <div className="space-y-3">
              {EXPENSE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{expenseCategoryLabel(category)}</span>
                  <MoneyInput
                    value={expenseAmounts[category]}
                    onChange={(value) => setExpenseAmounts((prev) => ({ ...prev, [category]: value }))}
                    className="w-36"
                  />
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--text)]">Ingresos presupuestados</h3>
              <span className="text-sm font-semibold text-accent">{formatCurrency(incomeTotal)}</span>
            </div>
            <p className="mb-3 text-xs text-subtle">
              Los pagos de cuotas aprobados se contabilizan en la categoría &quot;Cuotas&quot;.
            </p>
            <div className="space-y-3">
              {INCOME_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{incomeCategoryLabel(category)}</span>
                  <MoneyInput
                    value={incomeAmounts[category]}
                    onChange={(value) => setIncomeAmounts((prev) => ({ ...prev, [category]: value }))}
                    className="w-36"
                  />
                </label>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {isReserveComponents ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--text)]">Gastos de capital presupuestados</h3>
              <span className="text-sm font-semibold text-accent">
                {formatCurrency(reserveComponentsExpenseTotal)}
              </span>
            </div>
            <div className="space-y-3">
              {RESERVE_EXPENSE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{reserveExpenseCategoryLabel(category)}</span>
                  <MoneyInput
                    value={reserveExpenseAmounts[category]}
                    onChange={(value) =>
                      setReserveExpenseAmounts((prev) => ({ ...prev, [category]: value }))
                    }
                    className="w-36"
                  />
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--text)]">Aportación anual presupuestada</h3>
              <span className="text-sm font-semibold text-accent">
                {formatCurrency(
                  Number(reserveIncomeAmount || 0) > 0
                    ? Number(reserveIncomeAmount)
                    : reserveComponentsExpenseTotal,
                )}
              </span>
            </div>
            <p className="mb-3 text-xs text-subtle">
              Monto que el condominio planea recaudar para reserva este año. Si lo dejas vacío, se usa la suma de
              componentes.
            </p>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Aportación a reserva</span>
              <MoneyInput
                value={reserveIncomeAmount}
                onChange={setReserveIncomeAmount}
                placeholder={
                  reserveComponentsExpenseTotal > 0 ? String(reserveComponentsExpenseTotal) : ''
                }
                className="w-36"
              />
            </label>
          </GlassCard>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || (isReservePercent && !operatingBudget)}
          className="glass-btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar presupuesto'}
        </button>
      </div>
    </div>
  );
}
