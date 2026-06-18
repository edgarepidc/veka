'use client';

import { useMemo, useState } from 'react';
import type { ChargeStatus, ExpenseStatus, FundType, PaymentStatus, PeriodMode } from '@veka/shared';
import {
  EXPENSE_CHART_COLORS,
  dateInMonth,
  dateInYear,
  expenseCategoryLabel,
  formatCurrency,
  fundTypeLabel,
  matchesFinanceClusterFilter,
  monthLabel,
  parseYearMonth,
  paymentPeriodDate,
} from '@veka/shared';

import { ComparisonBarChart, ExpensePieChart, TrendBarChart } from '@/components/FinanceCharts';
import { GlassCard } from '@/components/ui/GlassCard';

interface FundBalanceRow {
  fund_type: FundType;
  balance: number;
  as_of_date: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  created_at: string;
  paid_at: string | null;
  unit: { identifier: string; cluster_id: string | null } | null;
  charge: { concept: string } | null;
}

interface ExpenseRow {
  amount: number;
  category: string;
  expense_date: string;
  status: ExpenseStatus;
  cluster_id: string | null;
}

interface IncomeRow {
  amount: number;
  category: string;
  income_date: string;
  cluster_id: string | null;
}

interface ChargeRow {
  amount: number;
  due_date: string;
  status: ChargeStatus;
  unit: { cluster_id: string | null } | null;
}

interface ClusterOption {
  id: string;
  name: string;
}

interface CondominiumOption {
  id: string;
  name: string;
}

export function FinanceEstadoPanel({
  clusters,
  clusterId,
  pendingReviewCount,
  funds,
  payments,
  expenses,
  incomeEntries,
  charges,
  totalReceivable,
  totalPayables,
}: {
  clusters: ClusterOption[];
  clusterId: string;
  pendingReviewCount: number;
  funds: FundBalanceRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  incomeEntries: IncomeRow[];
  charges: ChargeRow[];
  totalReceivable: number;
  totalPayables: number;
}) {
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const parsedMonth = parseYearMonth(selectedMonth);
  const year = periodMode === 'year' ? Number(selectedYear) : (parsedMonth?.year ?? now.getFullYear());
  const month = parsedMonth?.month ?? now.getMonth() + 1;

  const scopePayments = useMemo(
    () =>
      payments.filter((payment) =>
        matchesFinanceClusterFilter(payment.unit?.cluster_id, clusterId),
      ),
    [clusterId, payments],
  );

  const scopeExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        matchesFinanceClusterFilter(expense.cluster_id, clusterId, { condoWideApplies: true }),
      ),
    [clusterId, expenses],
  );

  const scopeIncomeEntries = useMemo(
    () =>
      incomeEntries.filter((income) =>
        matchesFinanceClusterFilter(income.cluster_id, clusterId, { condoWideApplies: true }),
      ),
    [clusterId, incomeEntries],
  );

  const scopeCharges = useMemo(
    () =>
      charges.filter((charge) => matchesFinanceClusterFilter(charge.unit?.cluster_id, clusterId)),
    [charges, clusterId],
  );

  const analytics = useMemo(() => {
    const approved = scopePayments.filter((p) => p.status === 'approved');
    const paidExpenses = scopeExpenses.filter((e) => e.status === 'paid');

    const inPeriod = (iso: string) =>
      periodMode === 'year' ? dateInYear(iso, year) : dateInMonth(iso, year, month);

    const periodPayments = approved.filter((p) =>
      inPeriod(paymentPeriodDate(p.paid_at, p.created_at)),
    );
    const periodManualIncome = scopeIncomeEntries.filter((income) => inPeriod(income.income_date));
    const periodExpenses = paidExpenses.filter((e) => inPeriod(e.expense_date));

    const paymentIncome = periodPayments.reduce((s, p) => s + Number(p.amount), 0);
    const manualIncome = periodManualIncome.reduce((s, income) => s + Number(income.amount), 0);
    const periodIncome = paymentIncome + manualIncome;
    const periodExpenseTotal = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const periodCharges = scopeCharges.filter((c) => inPeriod(c.due_date) && c.status !== 'cancelled');
    const collected = periodCharges.filter((c) => c.status === 'paid');
    const collectionRate =
      periodCharges.length > 0
        ? Math.round((collected.length / periodCharges.length) * 100)
        : null;

    const expenseByCategory = periodExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + Number(expense.amount);
      return acc;
    }, {});

    const pieSlices = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value], index) => ({
        label: expenseCategoryLabel(category),
        value,
        color: EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length]!,
      }));

    const trendMonths =
      periodMode === 'year'
        ? Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }))
        : Array.from({ length: 6 }, (_, i) => {
            const d = new Date(year, month - 1 - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          });

    const paymentTrend = trendMonths.map(({ year: y, month: m }) => {
      const paymentsTotal = approved
        .filter((p) => dateInMonth(paymentPeriodDate(p.paid_at, p.created_at), y, m))
        .reduce((s, p) => s + Number(p.amount), 0);
      const manualTotal = scopeIncomeEntries
        .filter((income) => dateInMonth(income.income_date, y, m))
        .reduce((s, income) => s + Number(income.amount), 0);
      return {
        label: monthLabel(y, m),
        value: paymentsTotal + manualTotal,
      };
    });

    const clusterLabel = clusterId
      ? (clusters.find((cluster) => cluster.id === clusterId)?.name ?? 'Cluster')
      : 'Todo el condominio';

    return {
      periodIncome,
      periodExpenseTotal,
      periodBalance: periodIncome - periodExpenseTotal,
      collectionRate,
      periodChargesCount: periodCharges.length,
      collectedCount: collected.length,
      pieSlices,
      paymentTrend,
      periodLabel:
        periodMode === 'year' ? String(year) : monthLabel(year, month),
      scopeLabel: clusterLabel,
      manualIncome,
      paymentIncome,
    };
  }, [clusterId, clusters, month, periodMode, scopeCharges, scopeExpenses, scopeIncomeEntries, scopePayments, year]);

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Dashboard financiero</h2>
            <p className="mt-1 text-sm text-muted">
              Vista del periodo:{' '}
              <span className="font-semibold text-[var(--text)]">{analytics.periodLabel}</span>
              {' · '}
              <span className="font-semibold text-[var(--text)]">{analytics.scopeLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="glass-tab-strip !inline-flex">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`glass-tab !min-w-0 !flex-none px-4 ${periodMode === 'month' ? 'glass-tab-active' : ''}`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('year')}
                className={`glass-tab !min-w-0 !flex-none px-4 ${periodMode === 'year' ? 'glass-tab-active' : ''}`}
              >
                Año
              </button>
            </div>
            {periodMode === 'month' ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass-input w-auto"
              />
            ) : (
              <input
                type="number"
                min="2020"
                max="2100"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="glass-input w-28"
              />
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ingresos del periodo" value={formatCurrency(analytics.periodIncome)} tone="green" />
        <SummaryCard label="Egresos del periodo" value={formatCurrency(analytics.periodExpenseTotal)} tone="neutral" />
        <SummaryCard
          label="Balance del periodo"
          value={formatCurrency(analytics.periodBalance)}
          tone={analytics.periodBalance >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label="Tasa de cobranza"
          value={analytics.collectionRate === null ? '—' : `${analytics.collectionRate}%`}
          sub={
            analytics.periodChargesCount > 0
              ? `${analytics.collectedCount}/${analytics.periodChargesCount} cuotas`
              : 'Sin cuotas en el periodo'
          }
          tone="amber"
        />
      </div>

      {analytics.manualIncome > 0 ? (
        <p className="text-xs text-subtle">
          Incluye {formatCurrency(analytics.paymentIncome)} en pagos aprobados y{' '}
          {formatCurrency(analytics.manualIncome)} en ingresos registrados manualmente.
        </p>
      ) : null}

      {pendingReviewCount > 0 ? (
        <GlassCard className="!border-amber-400/25 !bg-amber-500/5">
          <p className="text-sm text-amber-100">
            <span className="font-semibold">{pendingReviewCount}</span> comprobante
            {pendingReviewCount === 1 ? '' : 's'} de residentes pendiente
            {pendingReviewCount === 1 ? '' : 's'} de validación. Revísalo en{' '}
            <span className="font-semibold">Ingresos y egresos</span>.
          </p>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Por cobrar (morosos)" value={formatCurrency(totalReceivable)} tone="amber" />
        <SummaryCard label="Adeudos a proveedores" value={formatCurrency(totalPayables)} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Egresos por categoría</h3>
          <p className="mt-1 text-sm text-muted">Distribución de gastos comprobados en el periodo.</p>
          <div className="mt-4">
            <ExpensePieChart slices={analytics.pieSlices} />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Tendencia de ingresos</h3>
          <p className="mt-1 text-sm text-muted">
            Pagos aprobados e ingresos manuales {periodMode === 'year' ? `en ${year}` : '(últimos 6 meses)'}.
          </p>
          <div className="mt-4">
            <TrendBarChart bars={analytics.paymentTrend} />
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="text-base font-semibold text-[var(--text)]">Ingresos vs egresos</h3>
        <p className="mt-1 text-sm text-muted">Comparativo del periodo y alcance seleccionados.</p>
        <div className="mt-4">
          <ComparisonBarChart income={analytics.periodIncome} expenses={analytics.periodExpenseTotal} />
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Saldos por fondo</h2>
        <p className="mt-1 text-sm text-muted">Posición actual de caja (no filtrada por periodo ni torre).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {funds.length === 0 ? (
            <p className="text-sm text-subtle">Sin saldos registrados.</p>
          ) : (
            funds.map((fund) => (
              <div key={fund.fund_type} className="glass-card-deep p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  {fundTypeLabel(fund.fund_type)}
                </p>
                <p className="mt-1 text-2xl font-bold text-accent">{formatCurrency(Number(fund.balance))}</p>
                <p className="mt-1 text-xs text-subtle">Al {fund.as_of_date}</p>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'green' | 'neutral' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-accent'
      : tone === 'amber'
        ? 'text-amber-200'
        : tone === 'red'
          ? 'text-red-200'
          : 'text-[var(--text)]';

  return (
    <div className="glass-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-subtle">{sub}</p> : null}
    </div>
  );
}
