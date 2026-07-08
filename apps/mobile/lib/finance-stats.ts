import { chargeBalanceDue } from '@veka/shared';

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
