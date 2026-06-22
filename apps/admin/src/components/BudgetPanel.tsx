'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { FundType } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  FUND_TYPES,
  INCOME_CATEGORIES,
  budgetProrateRatio,
  buildBudgetSummary,
  expenseCategoryLabel,
  formatCurrency,
  fundTypeLabel,
  incomeCategoryLabel,
} from '@veka/shared';

import { saveAnnualBudget } from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';
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
  notes: string | null;
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
    fee_campaign?: { scope: string } | null;
    recurring_fee?: { scope: string } | null;
  } | null;
}

export function BudgetPanel({
  condominiumId,
  budgets,
  clusterFilterId,
  clusterUnitCount,
  totalUnitCount,
  scopeLabel,
  expenses,
  incomeEntries,
  payments,
  onReload,
}: {
  condominiumId: string;
  budgets: AnnualBudgetRow[];
  clusterFilterId: string;
  clusterUnitCount: number;
  totalUnitCount: number;
  scopeLabel: string;
  expenses: ExpenseForBudgetPanel[];
  incomeEntries: IncomeForBudgetPanel[];
  payments: PaymentForBudgetPanel[];
  onReload: () => void;
}) {
  const [fiscalYear, setFiscalYear] = useState(String(currentYear()));
  const [fundType, setFundType] = useState<FundType>('operating');
  const [notes, setNotes] = useState('');
  const [expenseAmounts, setExpenseAmounts] = useState<Record<string, string>>(() =>
    emptyAmounts(EXPENSE_CATEGORIES),
  );
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>(() =>
    emptyAmounts(INCOME_CATEGORIES),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startSave] = useTransition();

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return [y - 1, y, y + 1];
  }, []);

  const existing = useMemo(
    () =>
      budgets.find(
        (budget) => budget.fiscal_year === Number(fiscalYear) && budget.fund_type === fundType,
      ),
    [budgets, fiscalYear, fundType],
  );

  useEffect(() => {
    const nextExpenses = emptyAmounts(EXPENSE_CATEGORIES);
    const nextIncome = emptyAmounts(INCOME_CATEGORIES);
    for (const line of existing?.lines ?? []) {
      const value = String(line.annual_amount);
      if (line.line_kind === 'expense') nextExpenses[line.category] = value;
      if (line.line_kind === 'income') nextIncome[line.category] = value;
    }
    setExpenseAmounts(nextExpenses);
    setIncomeAmounts(nextIncome);
    setNotes(existing?.notes ?? '');
  }, [existing]);

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

  const scoped = Boolean(clusterFilterId);
  const prorate = budgetProrateRatio(clusterUnitCount, totalUnitCount, scoped);
  const budgetSummary = useMemo(() => {
    const scopedExpenses = expenses.filter((row) =>
      !clusterFilterId || row.cluster_id === clusterFilterId || row.cluster_id == null,
    );
    const scopedIncome = incomeEntries.filter((row) =>
      !clusterFilterId || row.cluster_id === clusterFilterId || row.cluster_id == null,
    );
    const scopedPayments = payments.filter((row) =>
      !clusterFilterId || row.unit?.cluster_id === clusterFilterId,
    );
    return buildBudgetSummary({
      fiscalYear: Number(fiscalYear),
      periodMode: 'year',
      month: new Date().getMonth() + 1,
      fundType,
      budgetLines: existing?.lines ?? [],
      expenses: scopedExpenses,
      incomeEntries: scopedIncome,
      payments: scopedPayments,
      prorateRatio: prorate,
      scoped,
    });
  }, [
    clusterFilterId,
    existing?.lines,
    expenses,
    fiscalYear,
    fundType,
    incomeEntries,
    payments,
    prorate,
    scoped,
  ]);

  function handleSave() {
    setMessage(null);
    const formData = new FormData();
    formData.set('fiscal_year', fiscalYear);
    formData.set('condominium_id', condominiumId);
    formData.set('fund_type', fundType);
    formData.set('notes', notes);
    for (const category of EXPENSE_CATEGORIES) {
      formData.set(`expense_${category}`, expenseAmounts[category] ?? '');
    }
    for (const category of INCOME_CATEGORIES) {
      formData.set(`income_${category}`, incomeAmounts[category] ?? '');
    }

    startSave(async () => {
      const result = await saveAnnualBudget(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Presupuesto guardado.');
      onReload();
    });
  }

  return (
    <div className="space-y-6">
      {clusterFilterId ? (
        <p className="text-sm text-muted">
          Presupuesto prorrateado para: <span className="font-medium text-[var(--text)]">{scopeLabel}</span>
          {budgetSummary.proratedNote ? ` · ${budgetSummary.proratedNote}` : ''}
        </p>
      ) : null}

      <GlassCard>
        <h3 className="text-base font-semibold text-[var(--text)]">Presupuesto vs real (año en curso)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <p className="text-xs text-subtle">Egresos</p>
            <p className="text-lg font-semibold text-[var(--text)]">
              {formatCurrency(budgetSummary.totalExpenseActual)} / {formatCurrency(budgetSummary.totalExpenseBudget)}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <p className="text-xs text-subtle">Ingresos</p>
            <p className="text-lg font-semibold text-[var(--text)]">
              {formatCurrency(budgetSummary.totalIncomeActual)} / {formatCurrency(budgetSummary.totalIncomeBudget)}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionHeading help={HELP.presupuesto}>Presupuesto anual</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Define montos anuales por categoría. En el estado financiero se comparan con lo real del
              periodo.
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
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={expenseAmounts[category]}
                  onChange={(event) =>
                    setExpenseAmounts((prev) => ({ ...prev, [category]: event.target.value }))
                  }
                  className="glass-input w-36 text-right"
                  placeholder="0"
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
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={incomeAmounts[category]}
                  onChange={(event) =>
                    setIncomeAmounts((prev) => ({ ...prev, [category]: event.target.value }))
                  }
                  className="glass-input w-36 text-right"
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="glass-btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar presupuesto'}
        </button>
      </div>
    </div>
  );
}
