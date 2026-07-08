import { chargeBalanceDue, expenseCategoryLabel, formatCurrency, incomeCategoryLabel } from '@veka/shared';

import type { FinanceCharge, FinancePayment, CondoExpense } from '@/hooks/useFinance';
import type { FinancePeriod } from '@/lib/finance-period';
import { inFinancePeriod, inPreviousFinancePeriod } from '@/lib/finance-period';

export interface CompareSlice {
  label: string;
  value: number;
  color: string;
}

export interface MonthlyBucket {
  key: string;
  label: string;
  value: number;
}

function monthKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1),
  );
}

export function buildMonthlyBuckets(
  entries: { date: string; amount: number }[],
  period: FinancePeriod,
  maxBars = 6,
): MonthlyBucket[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!inFinancePeriod(entry.date, period)) continue;
    const key = monthKey(entry.date);
    map.set(key, (map.get(key) ?? 0) + entry.amount);
  }

  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const trimmed = sorted.slice(-maxBars);
  return trimmed.map(([key, value]) => ({ key, label: monthLabel(key), value }));
}

export function personalPeriodStats(
  charges: FinanceCharge[],
  payments: FinancePayment[],
  period: FinancePeriod,
  colors: { paid: string; owed: string },
): { compare: CompareSlice[]; paidMonthly: MonthlyBucket[]; owedMonthly: MonthlyBucket[] } {
  const periodCharges = charges.filter((charge) => inFinancePeriod(charge.due_date, period));
  const periodPayments = payments.filter((payment) =>
    inFinancePeriod(payment.paid_at ?? payment.created_at, period),
  );

  const paid = periodPayments
    .filter((payment) => payment.status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const owed = periodCharges.reduce((sum, charge) => sum + chargeBalanceDue(charge), 0);

  const paidMonthly = buildMonthlyBuckets(
    periodPayments
      .filter((payment) => payment.status === 'approved')
      .map((payment) => ({
        date: payment.paid_at ?? payment.created_at,
        amount: payment.amount,
      })),
    period,
  );

  const owedMonthly = buildMonthlyBuckets(
    periodCharges
      .filter((charge) => chargeBalanceDue(charge) > 0)
      .map((charge) => ({ date: charge.due_date, amount: chargeBalanceDue(charge) })),
    period,
  );

  return {
    compare: [
      { label: 'Pagado', value: paid, color: colors.paid },
      { label: 'Pendiente', value: owed, color: colors.owed },
    ],
    paidMonthly,
    owedMonthly,
  };
}

export function condoPeriodStats(
  expenses: CondoExpense[],
  period: FinancePeriod,
  myClusterId: string | null,
  colors: { paid: string; pending: string; general: string; building: string },
): {
  compare: CompareSlice[];
  scopeCompare: CompareSlice[];
  periodPaidTotal: number;
} {
  const periodExpenses = expenses.filter((expense) => inFinancePeriod(expense.expense_date, period));

  const paid = periodExpenses
    .filter((expense) => expense.status === 'paid')
    .reduce((sum, expense) => sum + expense.amount, 0);

  const pending = periodExpenses
    .filter((expense) => expense.status === 'pending')
    .reduce((sum, expense) => sum + expense.amount, 0);

  const general = periodExpenses
    .filter((expense) => expense.cluster_id === null)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const building = periodExpenses
    .filter((expense) => myClusterId && expense.cluster_id === myClusterId)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const scopeCompare: CompareSlice[] = [{ label: 'General', value: general, color: colors.general }];
  if (myClusterId) {
    scopeCompare.push({ label: 'Mi edificio', value: building, color: colors.building });
  }

  return {
    compare: [
      { label: 'Pagado', value: paid, color: colors.paid },
      { label: 'Pendiente', value: pending, color: colors.pending },
    ],
    scopeCompare,
    periodPaidTotal: paid,
  };
}

export function filterVisibleCondoExpenses(
  expenses: CondoExpense[],
  myClusterId: string | null,
): CondoExpense[] {
  return expenses.filter(
    (expense) => expense.cluster_id === null || (myClusterId !== null && expense.cluster_id === myClusterId),
  );
}

export type CondoClusterFilter = 'all' | 'general' | string;

export function matchesCondoClusterFilter(
  clusterId: string | null,
  filter: CondoClusterFilter,
  myClusterId: string | null,
): boolean {
  if (filter === 'all') {
    return clusterId === null || (myClusterId !== null && clusterId === myClusterId);
  }
  if (filter === 'general') return clusterId === null;
  return clusterId === filter;
}

export interface CondoIncomeRow {
  id?: string;
  concept: string;
  category: string;
  cluster_id: string | null;
  income_date: string;
  amount: number;
  source: 'payment' | 'manual';
}

export function condoExpensePeriodStats(
  expenses: CondoExpense[],
  period: FinancePeriod,
): { paid: number; pending: number; total: number } {
  const periodExpenses = expenses.filter((expense) => inFinancePeriod(expense.expense_date, period));
  const paid = periodExpenses
    .filter((expense) => expense.status === 'paid')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const pending = periodExpenses
    .filter((expense) => expense.status === 'pending')
    .reduce((sum, expense) => sum + expense.amount, 0);
  return { paid, pending, total: paid + pending };
}

export function condoIncomePeriodStats(
  incomeRows: CondoIncomeRow[],
  period: FinancePeriod,
): { cuotas: number; otros: number; total: number } {
  const periodRows = incomeRows.filter((row) => inFinancePeriod(row.income_date, period));
  const cuotas = periodRows
    .filter((row) => row.source === 'payment' || row.category === 'cuotas')
    .reduce((sum, row) => sum + row.amount, 0);
  const otros = periodRows
    .filter((row) => row.source === 'manual' && row.category !== 'cuotas')
    .reduce((sum, row) => sum + row.amount, 0);
  return { cuotas, otros, total: cuotas + otros };
}

export interface CategorySlice {
  label: string;
  value: number;
  color: string;
  percent: number;
}

const PIE_COLORS = [
  '#2563EB',
  '#0EA5E9',
  '#059669',
  '#7C3AED',
  '#F59E0B',
  '#DC2626',
  '#64748B',
];

export function expenseCategoryBreakdown(
  expenses: CondoExpense[],
  period: FinancePeriod,
  maxSlices = 5,
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!inFinancePeriod(expense.expense_date, period)) continue;
    if (expense.status !== 'paid') continue;
    const key = expense.category || 'otros';
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((sum, [, value]) => sum + value, 0);
  if (grandTotal <= 0) return [];

  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices).reduce((sum, [, value]) => sum + value, 0);
  const rows = rest > 0 ? [...top, ['otros', rest] as const] : top;

  return rows.map(([category, value], index) => ({
    label:
      category === 'otros' && index === rows.length - 1 && sorted.length > maxSlices
        ? 'Otros'
        : expenseCategoryLabel(category),
    value,
    color: PIE_COLORS[index % PIE_COLORS.length],
    percent: (value / grandTotal) * 100,
  }));
}

export interface CondoCollectionFlowRow {
  cluster_id: string | null;
  item_date: string;
  amount: number;
  item_kind: 'charge_due' | 'payment_collected';
}

export function condoPeriodBalance(incomeTotal: number, expensesPaid: number, expensesPending: number) {
  const net = incomeTotal - expensesPaid;
  return {
    net,
    withCommitments: incomeTotal - (expensesPaid + expensesPending),
    label: net >= 0 ? 'Superávit del período' : 'Déficit del período',
  };
}

export function condoCollectionStats(
  rows: CondoCollectionFlowRow[],
  period: FinancePeriod,
  clusterFilter: CondoClusterFilter,
  myClusterId: string | null,
): { expected: number; collected: number; percent: number | null } {
  const targetClusterId =
    clusterFilter === 'all' || clusterFilter === 'general' ? myClusterId : clusterFilter;

  if (!targetClusterId) {
    return { expected: 0, collected: 0, percent: null };
  }

  const scoped = rows.filter(
    (row) =>
      row.cluster_id === targetClusterId && inFinancePeriod(row.item_date, period),
  );

  const expected = scoped
    .filter((row) => row.item_kind === 'charge_due')
    .reduce((sum, row) => sum + row.amount, 0);
  const collected = scoped
    .filter((row) => row.item_kind === 'payment_collected')
    .reduce((sum, row) => sum + row.amount, 0);

  return {
    expected,
    collected,
    percent: expected > 0 ? (collected / expected) * 100 : null,
  };
}

export interface CondoBudgetLine {
  line_kind: 'expense' | 'income';
  category: string;
  annual_amount: number;
}

function periodBudgetFactor(period: FinancePeriod): number {
  if (period === '1m') return 1 / 12;
  if (period === '3m') return 3 / 12;
  const month = new Date().getMonth() + 1;
  return month / 12;
}

export function condoBudgetExecution(
  lines: CondoBudgetLine[],
  paidExpenses: CondoExpense[],
  period: FinancePeriod,
): {
  totalBudget: number;
  totalActual: number;
  percentUsed: number | null;
  highlights: { label: string; percentUsed: number; actual: number; budget: number }[];
} {
  const factor = periodBudgetFactor(period);
  const expenseLines = lines.filter((line) => line.line_kind === 'expense');
  const totalBudget = expenseLines.reduce((sum, line) => sum + line.annual_amount * factor, 0);

  const actualByCategory = new Map<string, number>();
  for (const expense of paidExpenses) {
    if (!inFinancePeriod(expense.expense_date, period)) continue;
    if (expense.status !== 'paid') continue;
    const key = expense.category || 'otros';
    actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + expense.amount);
  }

  const totalActual = [...actualByCategory.values()].reduce((sum, value) => sum + value, 0);
  const highlights = expenseLines
    .map((line) => {
      const budget = line.annual_amount * factor;
      const actual = actualByCategory.get(line.category) ?? 0;
      return {
        label: expenseCategoryLabel(line.category),
        budget,
        actual,
        percentUsed: budget > 0 ? (actual / budget) * 100 : actual > 0 ? 100 : 0,
      };
    })
    .filter((row) => row.budget > 0 || row.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 3);

  return {
    totalBudget,
    totalActual,
    percentUsed: totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
    highlights,
  };
}

export function condoIncomeDetailRows(
  rows: CondoIncomeRow[],
  period: FinancePeriod,
  clusterFilter: CondoClusterFilter,
  myClusterId: string | null,
): CondoIncomeRow[] {
  return rows
    .filter(
      (row) =>
        inFinancePeriod(row.income_date, period) &&
        matchesCondoClusterFilter(row.cluster_id, clusterFilter, myClusterId),
    )
    .sort((a, b) => b.income_date.localeCompare(a.income_date));
}

export function incomeRowCategoryLabel(row: CondoIncomeRow): string {
  if (row.source === 'payment') return 'Cuota cobrada';
  return incomeCategoryLabel(row.category);
}

export interface MonthlyTrendBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

function trendMonthKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function trendMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(year, month - 1, 1));
}

export function condoMonthlyTrend(
  incomeRows: CondoIncomeRow[],
  expenses: CondoExpense[],
  clusterFilter: CondoClusterFilter,
  myClusterId: string | null,
  maxMonths = 4,
): MonthlyTrendBucket[] {
  const scopedIncome = incomeRows.filter((row) =>
    matchesCondoClusterFilter(row.cluster_id, clusterFilter, myClusterId),
  );
  const scopedExpenses = expenses.filter((expense) =>
    matchesCondoClusterFilter(expense.cluster_id, clusterFilter, myClusterId),
  );

  const keys = new Set<string>();
  const now = new Date();
  for (let i = maxMonths - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const row of scopedIncome) {
    const key = trendMonthKey(row.income_date);
    if (!keys.has(key)) continue;
    incomeMap.set(key, (incomeMap.get(key) ?? 0) + row.amount);
  }

  for (const expense of scopedExpenses) {
    if (expense.status !== 'paid') continue;
    const key = trendMonthKey(expense.expense_date);
    if (!keys.has(key)) continue;
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + expense.amount);
  }

  return [...keys].map((key) => ({
    key,
    label: trendMonthLabel(key),
    income: incomeMap.get(key) ?? 0,
    expense: expenseMap.get(key) ?? 0,
  }));
}

export function formatPeriodDelta(current: number, previous: number): {
  delta: number;
  percent: number | null;
  label: string;
} {
  const delta = current - previous;
  const percent = previous > 0 ? (delta / previous) * 100 : null;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const pctLabel = percent !== null ? ` (${sign}${Math.abs(percent).toFixed(0)}%)` : '';
  return {
    delta,
    percent,
    label: `${sign}${formatCurrency(Math.abs(delta))}${pctLabel} vs período anterior`,
  };
}

export function condoPeriodComparisons(
  incomeRows: CondoIncomeRow[],
  expenses: CondoExpense[],
  period: FinancePeriod,
  clusterFilter: CondoClusterFilter,
  myClusterId: string | null,
): {
  income: ReturnType<typeof formatPeriodDelta>;
  expenses: ReturnType<typeof formatPeriodDelta>;
  balance: ReturnType<typeof formatPeriodDelta>;
} {
  const scopedIncome = incomeRows.filter((row) =>
    matchesCondoClusterFilter(row.cluster_id, clusterFilter, myClusterId),
  );
  const scopedExpenses = expenses.filter((expense) =>
    matchesCondoClusterFilter(expense.cluster_id, clusterFilter, myClusterId),
  );

  const sumIncome = (usePrevious: boolean) =>
    scopedIncome
      .filter((row) =>
        usePrevious
          ? inPreviousFinancePeriod(row.income_date, period)
          : inFinancePeriod(row.income_date, period),
      )
      .reduce((sum, row) => sum + row.amount, 0);

  const sumExpensesPaid = (usePrevious: boolean) =>
    scopedExpenses
      .filter(
        (expense) =>
          expense.status === 'paid' &&
          (usePrevious
            ? inPreviousFinancePeriod(expense.expense_date, period)
            : inFinancePeriod(expense.expense_date, period)),
      )
      .reduce((sum, expense) => sum + expense.amount, 0);

  const incomeCurrent = sumIncome(false);
  const incomePrevious = sumIncome(true);
  const expenseCurrent = sumExpensesPaid(false);
  const expensePrevious = sumExpensesPaid(true);
  const balanceCurrent = incomeCurrent - expenseCurrent;
  const balancePrevious = incomePrevious - expensePrevious;

  return {
    income: formatPeriodDelta(incomeCurrent, incomePrevious),
    expenses: formatPeriodDelta(expenseCurrent, expensePrevious),
    balance: formatPeriodDelta(balanceCurrent, balancePrevious),
  };
}

