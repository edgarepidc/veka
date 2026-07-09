'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CardAccentTone, ChargeStatus, ExpenseStatus, FundType, PaymentStatus, PeriodMode } from '@veka/shared';
import {
  EXPENSE_CHART_COLORS,
  budgetProrateRatio,
  buildBudgetSummary,
  cashFlowBars,
  collectionRateByCluster,
  dateInMonth,
  delinquencyAgingBars,
  expenseCategoryLabel,
  formatCurrency,
  formatExportDate,
  formatPercentChange,
  fundTypeLabel,
  inComparablePreviousPeriod,
  inFinancePeriod,
  incomeBreakdownSlices,
  matchesFinanceClusterFilter,
  monthLabel,
  parseYearMonth,
  paymentPeriodDate,
  percentChange,
  type FinancialReportExport,
} from '@veka/shared';

import { ExportMenu } from '@/components/ExportMenu';
import {
  BudgetVsActualChart,
  ComparisonBarChart,
  ExpensePieChart,
  HorizontalBarChart,
  SignedBarChart,
  TrendBarChart,
} from '@/components/FinanceCharts';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  downloadFinancialReportCsv,
  exportFinancialReportPdf,
} from '@/lib/finance-export-client';

interface FundBalanceRow {
  fund_type: FundType;
  balance: number;
  opening_balance: number;
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
  charge: {
    concept: string;
    charge_kind?: string;
    fee_campaign?: { scope: string } | null;
    recurring_fee?: { scope: string } | null;
  } | null;
}

interface ExpenseRow {
  amount: number;
  category: string;
  expense_date: string;
  status: ExpenseStatus;
  cluster_id: string | null;
  fund_type: FundType;
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

interface BudgetLineRow {
  line_kind: 'expense' | 'income';
  category: string;
  annual_amount: number;
}

interface AnnualBudgetRow {
  fiscal_year: number;
  fund_type: FundType;
  lines: BudgetLineRow[];
}

export function FinanceEstadoPanel({
  condominiumName,
  clusters,
  clusterId,
  pendingReviewCount,
  funds,
  payments,
  expenses,
  incomeEntries,
  charges,
  budgets,
  totalUnitCount,
  clusterUnitCount,
  totalReceivable,
  totalPayables,
  onSaveOpeningBalance,
}: {
  condominiumName: string;
  clusters: ClusterOption[];
  clusterId: string;
  pendingReviewCount: number;
  funds: FundBalanceRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  incomeEntries: IncomeRow[];
  charges: ChargeRow[];
  budgets: AnnualBudgetRow[];
  totalUnitCount: number;
  clusterUnitCount: number;
  totalReceivable: number;
  totalPayables: number;
  onSaveOpeningBalance: (fundType: FundType, amount: number) => Promise<{ error?: string }>;
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
    const reference = new Date();
    const approved = scopePayments.filter((p) => p.status === 'approved');
    const paidExpenses = scopeExpenses.filter((e) => e.status === 'paid');

    const inPeriod = (iso: string) => inFinancePeriod(iso, periodMode, year, month, reference);

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

    const previousIncome = (() => {
      const prevPayments = approved.filter((p) =>
        inComparablePreviousPeriod(
          paymentPeriodDate(p.paid_at, p.created_at),
          periodMode,
          year,
          month,
          reference,
        ),
      );
      const prevManual = scopeIncomeEntries.filter((income) =>
        inComparablePreviousPeriod(income.income_date, periodMode, year, month, reference),
      );
      return (
        prevPayments.reduce((s, p) => s + Number(p.amount), 0) +
        prevManual.reduce((s, income) => s + Number(income.amount), 0)
      );
    })();

    const previousExpenses = paidExpenses
      .filter((e) => inComparablePreviousPeriod(e.expense_date, periodMode, year, month, reference))
      .reduce((s, e) => s + Number(e.amount), 0);

    const incomeSlices = incomeBreakdownSlices(
      approved.filter((p) => inPeriod(paymentPeriodDate(p.paid_at, p.created_at))),
      scopeIncomeEntries.filter((income) => inPeriod(income.income_date)),
    );
    const collectionBars = collectionRateByCluster(scopeCharges, clusters, {
      dueInPeriod: (dueDate) => inPeriod(dueDate),
    });
    const agingBars = delinquencyAgingBars(
      scopeCharges.filter((c) => c.status === 'overdue' || c.status === 'pending'),
    );
    const cashFlow = cashFlowBars(
      scopePayments,
      scopeExpenses,
      scopeIncomeEntries,
      trendMonths,
    );

    return {
      periodIncome,
      periodExpenseTotal,
      periodBalance: periodIncome - periodExpenseTotal,
      collectionRate,
      periodChargesCount: periodCharges.length,
      collectedCount: collected.length,
      pieSlices,
      paymentTrend,
      incomeSlices,
      collectionBars,
      agingBars,
      cashFlow,
      incomeChange: percentChange(periodIncome, previousIncome),
      expenseChange: percentChange(periodExpenseTotal, previousExpenses),
      balanceChange: percentChange(periodIncome - periodExpenseTotal, previousIncome - previousExpenses),
      periodLabel:
        periodMode === 'year'
          ? year === reference.getFullYear()
            ? `${year} (acumulado)`
            : String(year)
          : monthLabel(year, month),
      scopeLabel: clusterLabel,
      manualIncome,
      paymentIncome,
    };
  }, [clusterId, clusters, month, periodMode, scopeCharges, scopeExpenses, scopeIncomeEntries, scopePayments, year]);

  const scoped = Boolean(clusterId);
  const prorate = budgetProrateRatio(clusterUnitCount, totalUnitCount, scoped);
  const operatingBudget = budgets.find((budget) => budget.fiscal_year === year && budget.fund_type === 'operating');
  const reserveBudget = budgets.find((budget) => budget.fiscal_year === year && budget.fund_type === 'reserve');
  const budgetSummary = useMemo(
    () =>
      buildBudgetSummary({
        fiscalYear: year,
        periodMode,
        month,
        fundType: 'operating',
        budgetLines: operatingBudget?.lines ?? [],
        expenses: scopeExpenses,
        incomeEntries: scopeIncomeEntries,
        payments: scopePayments,
        prorateRatio: prorate,
        scoped,
      }),
    [
      month,
      operatingBudget?.lines,
      periodMode,
      prorate,
      scopeExpenses,
      scopeIncomeEntries,
      scopePayments,
      scoped,
      year,
    ],
  );

  const reserveBudgetSummary = useMemo(
    () =>
      buildBudgetSummary({
        fiscalYear: year,
        periodMode,
        month,
        fundType: 'reserve',
        budgetLines: reserveBudget?.lines ?? [],
        expenses: scopeExpenses,
        incomeEntries: scopeIncomeEntries,
        payments: scopePayments,
        prorateRatio: prorate,
        scoped,
      }),
    [
      month,
      periodMode,
      prorate,
      reserveBudget?.lines,
      scopeExpenses,
      scopeIncomeEntries,
      scopePayments,
      scoped,
      year,
    ],
  );

  const exportReport = useMemo<FinancialReportExport>(
    () => ({
      condominiumName,
      periodLabel: analytics.periodLabel,
      scopeLabel: analytics.scopeLabel,
      generatedAt: formatExportDate(),
      kpis: [
        {
          label: 'Ingresos del periodo',
          value: formatCurrency(analytics.periodIncome),
          change: formatPercentChange(analytics.incomeChange),
        },
        {
          label: 'Egresos del periodo',
          value: formatCurrency(analytics.periodExpenseTotal),
          change: formatPercentChange(analytics.expenseChange),
        },
        {
          label: 'Balance del periodo',
          value: formatCurrency(analytics.periodBalance),
          change: formatPercentChange(analytics.balanceChange),
        },
        {
          label: 'Tasa de cobranza',
          value: analytics.collectionRate !== null ? `${analytics.collectionRate}%` : 'N/D',
          change: null,
        },
      ],
      incomeByCategory: analytics.incomeSlices.map((slice) => ({
        label: slice.label,
        amount: slice.value,
      })),
      expenseByCategory: analytics.pieSlices.map((slice) => ({
        label: slice.label,
        amount: slice.value,
      })),
      budgetRows: budgetSummary.expenseRows.map((row) => ({
        label: row.label,
        budget: row.budget,
        actual: row.actual,
        variance: row.variance,
      })),
      fundBalances: funds.map((fund) => ({
        label: fundTypeLabel(fund.fund_type),
        amount: Number(fund.balance),
        asOf: fund.as_of_date,
      })),
      agingRows: analytics.agingBars.map((bar) => ({
        label: bar.label,
        amount: bar.value,
      })),
      totalReceivable,
      totalPayables,
      collectionRate: analytics.collectionRate,
    }),
    [
      analytics,
      budgetSummary.expenseRows,
      condominiumName,
      funds,
      totalPayables,
      totalReceivable,
    ],
  );

  return (
    <div className="space-y-6">
      <GlassCard className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--text)]">Dashboard financiero</h2>
            <p className="mt-0.5 text-xs text-muted">
              Vista del periodo:{' '}
              <span className="font-semibold text-[var(--text)]">{analytics.periodLabel}</span>
              {' · '}
              <span className="font-semibold text-[var(--text)]">{analytics.scopeLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              onCsv={() => downloadFinancialReportCsv(exportReport)}
              onPdf={() => exportFinancialReportPdf(exportReport)}
            />
            <div className="glass-tab-strip !inline-flex shrink-0">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`glass-tab !min-w-0 !flex-none px-3 py-1.5 ${periodMode === 'month' ? 'glass-tab-active' : ''}`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('year')}
                className={`glass-tab !min-w-0 !flex-none px-3 py-1.5 ${periodMode === 'year' ? 'glass-tab-active' : ''}`}
              >
                Año
              </button>
            </div>
            {periodMode === 'month' ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass-input w-[8.75rem] shrink-0 px-2 py-1.5 text-sm"
              />
            ) : (
              <input
                type="number"
                min="2020"
                max="2100"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="glass-input w-20 shrink-0 px-2 py-1.5 text-sm"
              />
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Ingresos del periodo"
          value={formatCurrency(analytics.periodIncome)}
          tone="green"
          change={analytics.incomeChange}
        />
        <SummaryCard
          label="Egresos del periodo"
          value={formatCurrency(analytics.periodExpenseTotal)}
          tone="neutral"
          change={analytics.expenseChange}
          invertChange
        />
        <SummaryCard
          label="Balance del periodo"
          value={formatCurrency(analytics.periodBalance)}
          tone={analytics.periodBalance >= 0 ? 'green' : 'red'}
          change={analytics.balanceChange}
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
        <GlassCard variant="accent" accent="orange" className="!p-4">
          <p className="text-sm text-[var(--text)]">
            <span className="font-semibold">{pendingReviewCount}</span> comprobante
            {pendingReviewCount === 1 ? '' : 's'} de residentes pendiente
            {pendingReviewCount === 1 ? '' : 's'} de validación. Revísalo en{' '}
            <span className="font-semibold">Ingresos y egresos</span>.
          </p>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Por cobrar (vencido)" value={formatCurrency(totalReceivable)} tone="amber" />
        <SummaryCard label="Proveedores pendientes" value={formatCurrency(totalPayables)} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Ingresos por origen</h3>
          <p className="mt-1 text-sm text-muted">Cuotas, extraordinarias y otros ingresos del periodo.</p>
          <div className="mt-4">
            <ExpensePieChart slices={analytics.incomeSlices} />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Egresos por categoría</h3>
          <p className="mt-1 text-sm text-muted">Distribución de gastos comprobados en el periodo.</p>
          <div className="mt-4">
            <ExpensePieChart slices={analytics.pieSlices} />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Cobranza por torre</h3>
          <p className="mt-1 text-sm text-muted">
            Porcentaje de cuotas con vencimiento en {analytics.periodLabel}.
          </p>
          <div className="mt-4">
            <HorizontalBarChart bars={analytics.collectionBars} />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Antigüedad de morosidad</h3>
          <p className="mt-1 text-sm text-muted">Monto vencido agrupado por días de atraso.</p>
          <div className="mt-4">
            <HorizontalBarChart
              bars={analytics.agingBars}
              maxValue={0}
              valueFormatter={(v) => formatCurrency(v)}
            />
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

        <GlassCard>
          <h3 className="text-base font-semibold text-[var(--text)]">Flujo de caja neto</h3>
          <p className="mt-1 text-sm text-muted">Ingresos menos egresos por mes (positivo = superávit).</p>
          <div className="mt-4">
            <SignedBarChart bars={analytics.cashFlow} />
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--text)]">Presupuesto vs real (egresos)</h3>
              <p className="mt-1 text-sm text-muted">
                Fondo operativo · {analytics.periodLabel}
                {budgetSummary.proratedNote ? ` · ${budgetSummary.proratedNote}` : ''}
              </p>
            </div>
            {budgetSummary.expensePercentUsed !== null ? (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-subtle">Ejecución</p>
                <p
                  className={`text-xl font-bold ${
                    budgetSummary.expensePercentUsed > 100 ? 'text-red-300' : 'text-accent'
                  }`}
                >
                  {budgetSummary.expensePercentUsed}%
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <BudgetVsActualChart
              rows={budgetSummary.expenseRows.map((row) => ({
                label: row.label,
                budget: row.budget,
                actual: row.actual,
              }))}
            />
          </div>
          {operatingBudget ? null : (
            <p className="mt-3 text-xs text-amber-200">
              No hay presupuesto operativo para {year}. Configúralo en la pestaña Presupuesto.
            </p>
          )}
        </GlassCard>

        {budgetSummary.incomeRows.length > 0 ? (
          <GlassCard className="lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Presupuesto vs real (ingresos)</h3>
                <p className="mt-1 text-sm text-muted">
                  Fondo operativo · {analytics.periodLabel}
                  {budgetSummary.proratedNote ? ` · ${budgetSummary.proratedNote}` : ''}
                </p>
              </div>
              {budgetSummary.incomePercentUsed !== null ? (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-subtle">Cumplimiento</p>
                  <p className="text-xl font-bold text-accent">{budgetSummary.incomePercentUsed}%</p>
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <BudgetVsActualChart
                rows={budgetSummary.incomeRows.map((row) => ({
                  label: row.label,
                  budget: row.budget,
                  actual: row.actual,
                }))}
              />
            </div>
          </GlassCard>
        ) : null}

        {(reserveBudgetSummary.expenseRows.length > 0 || reserveBudgetSummary.incomeRows.length > 0) ? (
          <GlassCard className="lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Presupuesto vs real (fondo de reserva)</h3>
                <p className="mt-1 text-sm text-muted">
                  {fundTypeLabel('reserve')} · {analytics.periodLabel}
                  {reserveBudgetSummary.proratedNote ? ` · ${reserveBudgetSummary.proratedNote}` : ''}
                </p>
              </div>
              {reserveBudgetSummary.expensePercentUsed !== null ? (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-subtle">Ejecución egresos</p>
                  <p
                    className={`text-xl font-bold ${
                      reserveBudgetSummary.expensePercentUsed > 100 ? 'text-red-300' : 'text-accent'
                    }`}
                  >
                    {reserveBudgetSummary.expensePercentUsed}%
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <BudgetVsActualChart
                rows={reserveBudgetSummary.expenseRows.map((row) => ({
                  label: row.label,
                  budget: row.budget,
                  actual: row.actual,
                }))}
              />
            </div>
          </GlassCard>
        ) : null}
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
        <p className="mt-1 text-sm text-muted">
          Posición actual de caja (no filtrada por periodo ni torre). El saldo inicial se suma a movimientos
          conciliados.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {funds.length === 0 ? (
            <p className="text-sm text-subtle">Sin saldos registrados.</p>
          ) : (
            funds.map((fund) => (
              <FundBalanceCard
                key={fund.fund_type}
                fund={fund}
                onSaveOpeningBalance={onSaveOpeningBalance}
              />
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
  change,
  invertChange = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'green' | 'neutral' | 'amber' | 'red';
  change?: number | null;
  invertChange?: boolean;
}) {
  const accentMap: Record<typeof tone, CardAccentTone | null> = {
    green: 'green',
    amber: 'orange',
    red: 'danger',
    neutral: null,
  };
  const accent = accentMap[tone];

  const toneClass =
    tone === 'green'
      ? 'text-accent'
      : tone === 'amber'
        ? 'text-accent-3'
        : tone === 'red'
          ? 'text-danger'
          : 'text-[var(--text)]';

  const changeLabel = formatPercentChange(change ?? null);
  const changePositive = (change ?? 0) > 0;
  const changeGood = invertChange ? !changePositive : changePositive;
  const changeClass =
    change === null || change === undefined
      ? 'text-subtle'
      : change === 0
        ? 'text-subtle'
        : changeGood
          ? 'text-accent'
          : 'text-danger';

  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {change != null ? (
        <p className={`mt-1 text-xs font-semibold ${changeClass}`}>
          vs periodo anterior {changeLabel}
        </p>
      ) : null}
      {sub ? <p className="mt-1 text-xs text-subtle">{sub}</p> : null}
    </>
  );

  if (accent) {
    return (
      <GlassCard variant="accent" accent={accent} className="!p-4">
        {body}
      </GlassCard>
    );
  }

  return <GlassCard className="!p-4">{body}</GlassCard>;
}

function FundBalanceCard({
  fund,
  onSaveOpeningBalance,
}: {
  fund: FundBalanceRow;
  onSaveOpeningBalance: (fundType: FundType, amount: number) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [openingInput, setOpeningInput] = useState(String(Number(fund.opening_balance)));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const amount = Number(openingInput.replace(/,/g, ''));
    if (!Number.isFinite(amount)) {
      setMessage('Monto inválido.');
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await onSaveOpeningBalance(fund.fund_type, amount);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setEditing(false);
      setMessage('Saldo inicial actualizado.');
    });
  }

  return (
    <GlassCard variant="accent" accent="green" className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {fundTypeLabel(fund.fund_type)}
      </p>
      <p className="mt-1 text-2xl font-bold text-accent">{formatCurrency(Number(fund.balance))}</p>
      <p className="mt-1 text-xs text-subtle">
        Saldo inicial: {formatCurrency(Number(fund.opening_balance))} · Al {fund.as_of_date}
      </p>
      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            type="number"
            step="0.01"
            value={openingInput}
            onChange={(e) => setOpeningInput(e.target.value)}
            className="glass-input text-sm"
            placeholder="Saldo inicial"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="glass-btn-primary text-xs"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setOpeningInput(String(Number(fund.opening_balance)));
                setMessage(null);
              }}
              className="text-xs text-muted hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-accent hover:underline"
        >
          Editar saldo inicial
        </button>
      )}
      {message ? <p className="mt-2 text-xs text-subtle">{message}</p> : null}
    </GlassCard>
  );
}
