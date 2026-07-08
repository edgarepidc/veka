import { chargeBalanceDue, expenseCategoryLabel } from '@veka/shared';

import type { FinanceCharge, FinancePayment, CondoExpense } from '@/hooks/useFinance';
import type { FinancePeriod } from '@/lib/finance-period';
import { inFinancePeriod } from '@/lib/finance-period';

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
    label: category === 'otros' && index === rows.length - 1 && sorted.length > maxSlices
      ? 'Otros'
      : expenseCategoryLabel(category),
    value,
    color: PIE_COLORS[index % PIE_COLORS.length],
    percent: (value / grandTotal) * 100,
  }));
}

