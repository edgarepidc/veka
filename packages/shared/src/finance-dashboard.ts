import type { ChartBar, ChartSlice } from './finance-analytics';
import { EXPENSE_CHART_COLORS, dateInMonth, paymentPeriodDate, roundMoney } from './finance-analytics';
import { incomeCategoryLabel } from './finance-scope';

export interface AgingBucket {
  id: string;
  label: string;
  minDays: number;
  maxDays: number | null;
}

export const DELINQUENCY_AGING_BUCKETS: AgingBucket[] = [
  { id: '0-30', label: '1–30 días', minDays: 1, maxDays: 30 },
  { id: '31-60', label: '31–60 días', minDays: 31, maxDays: 60 },
  { id: '61-90', label: '61–90 días', minDays: 61, maxDays: 90 },
  { id: '90+', label: 'Más de 90 días', minDays: 91, maxDays: null },
];

export interface ChargeForAnalytics {
  amount: number;
  due_date: string;
  status: string;
  unit?: { cluster_id: string | null } | null;
}

export interface PaymentForIncome {
  amount: number;
  status: string;
  paid_at?: string | null;
  created_at?: string;
  charge?: { concept: string } | null;
}

export interface IncomeEntryForAnalytics {
  amount: number;
  category: string;
  income_date: string;
}

export interface UnitStatementCharge {
  id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: string;
}

export interface UnitStatementPayment {
  id: string;
  charge_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface UnitStatementLine {
  id: string;
  date: string;
  kind: 'charge' | 'payment';
  concept: string;
  debit: number;
  credit: number;
  status: string;
}

export function daysPastDue(dueDate: string, reference = new Date()): number {
  const due = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T12:00:00`);
  const ref = new Date(reference);
  ref.setHours(12, 0, 0, 0);
  const diffMs = ref.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function isDelinquentCharge(charge: { due_date: string; status: string }, reference = new Date()): boolean {
  if (charge.status === 'overdue') return true;
  if (charge.status === 'pending' && daysPastDue(charge.due_date, reference) > 0) return true;
  return false;
}

export function delinquencyAgingBars(
  charges: ChargeForAnalytics[],
  reference = new Date(),
): ChartBar[] {
  const delinquent = charges.filter((charge) => isDelinquentCharge(charge, reference));

  return DELINQUENCY_AGING_BUCKETS.map((bucket) => {
    const value = delinquent
      .filter((charge) => {
        const days = daysPastDue(charge.due_date, reference);
        if (days === 0) return false;
        if (bucket.maxDays === null) return days >= bucket.minDays;
        return days >= bucket.minDays && days <= bucket.maxDays;
      })
      .reduce((sum, charge) => sum + Number(charge.amount), 0);

    return { label: bucket.label, value: roundMoney(value) };
  });
}

export function collectionRateByCluster(
  charges: ChargeForAnalytics[],
  clusters: { id: string; name: string }[],
): ChartBar[] {
  const stats = new Map<string, { label: string; total: number; paid: number }>();

  for (const cluster of clusters) {
    stats.set(cluster.id, { label: cluster.name, total: 0, paid: 0 });
  }
  stats.set('sin-cluster', { label: 'Sin torre', total: 0, paid: 0 });

  for (const charge of charges) {
    if (charge.status === 'cancelled') continue;
    const clusterId = charge.unit?.cluster_id ?? 'sin-cluster';
    const row = stats.get(clusterId) ?? stats.get('sin-cluster')!;
    row.total += 1;
    if (charge.status === 'paid') row.paid += 1;
  }

  return Array.from(stats.values())
    .filter((row) => row.total > 0)
    .map((row) => ({
      label: row.label,
      value: Math.round((row.paid / row.total) * 100),
      meta: `${row.paid}/${row.total} cuotas`,
    }));
}

export function incomeBreakdownSlices(
  payments: PaymentForIncome[],
  incomeEntries: IncomeEntryForAnalytics[],
): ChartSlice[] {
  let maintenance = 0;
  let extraordinary = 0;
  let otherPayments = 0;

  for (const payment of payments) {
    if (payment.status !== 'approved') continue;
    const amount = Number(payment.amount);
    const concept = payment.charge?.concept?.toLowerCase() ?? '';
    if (concept.includes('extraordinari')) extraordinary += amount;
    else if (concept.includes('mantenimiento') || concept.includes('cuota')) maintenance += amount;
    else otherPayments += amount;
  }

  const manualByCategory = incomeEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + Number(entry.amount);
    return acc;
  }, {});

  const raw: { label: string; value: number }[] = [
    { label: 'Cuotas de mantenimiento', value: maintenance },
    { label: 'Cuotas extraordinarias', value: extraordinary },
    { label: 'Otros pagos', value: otherPayments },
    ...Object.entries(manualByCategory).map(([category, value]) => ({
      label: incomeCategoryLabel(category),
      value,
    })),
  ].filter((item) => item.value > 0);

  return raw.map((item, index) => ({
    ...item,
    color: EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length]!,
  }));
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return null;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export function formatPercentChange(change: number | null): string {
  if (change === null) return '—';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change}%`;
}

export function cashFlowBars(
  payments: PaymentForIncome[],
  expenses: { amount: number; expense_date: string; status: string }[],
  incomeEntries: IncomeEntryForAnalytics[],
  months: { year: number; month: number }[],
): ChartBar[] {
  const approved = payments.filter((payment) => payment.status === 'approved');
  const paidExpenses = expenses.filter((expense) => expense.status === 'paid');

  return months.map(({ year, month }) => {
    const income =
      approved
        .filter((payment) =>
          dateInMonth(paymentPeriodDate(payment.paid_at ?? null, payment.created_at ?? ''), year, month),
        )
        .reduce((sum, payment) => sum + Number(payment.amount), 0) +
      incomeEntries
        .filter((entry) => dateInMonth(entry.income_date, year, month))
        .reduce((sum, entry) => sum + Number(entry.amount), 0);

    const outflow = paidExpenses
      .filter((expense) => dateInMonth(expense.expense_date, year, month))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    return {
      label: `${month}/${String(year).slice(-2)}`,
      value: roundMoney(income - outflow),
    };
  });
}

export function unitBalanceDue(charges: UnitStatementCharge[]): number {
  return roundMoney(
    charges
      .filter((charge) => charge.status === 'pending' || charge.status === 'overdue')
      .reduce((sum, charge) => sum + Number(charge.amount), 0),
  );
}

export type UnitStatementLineWithBalance = UnitStatementLine & { runningBalance: number };

export function buildUnitStatementWithBalance(
  charges: UnitStatementCharge[],
  payments: UnitStatementPayment[],
): { lines: UnitStatementLineWithBalance[]; balanceDue: number } {
  const chargeIds = new Set(charges.map((charge) => charge.id));
  const relevantPayments = payments.filter((payment) => chargeIds.has(payment.charge_id));

  const events = [
    ...charges.map((charge) => ({
      id: `charge-${charge.id}`,
      date: charge.due_date,
      kind: 'charge' as const,
      concept: charge.concept,
      debit: Number(charge.amount),
      credit: 0,
      status: charge.status,
    })),
    ...relevantPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: (payment.paid_at ?? payment.created_at).slice(0, 10),
      kind: 'payment' as const,
      concept:
        payment.status === 'approved'
          ? 'Pago aplicado'
          : payment.status === 'pending_review'
            ? 'Comprobante enviado'
            : 'Pago rechazado',
      debit: 0,
      credit: payment.status === 'approved' ? Number(payment.amount) : 0,
      status: payment.status,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

  let running = 0;
  const lines = events.map((event) => {
    running = roundMoney(running + event.debit - event.credit);
    return { ...event, runningBalance: running };
  });

  return { lines, balanceDue: unitBalanceDue(charges) };
}
