import { roundMoney } from './finance-analytics';
import { chargeBalanceDue, type ChargeForSettlement } from './payments';

export const PAYMENT_PLAN_STATUSES = ['active', 'completed', 'cancelled', 'defaulted'] as const;
export type PaymentPlanStatus = (typeof PAYMENT_PLAN_STATUSES)[number];

export const INSTALLMENT_STATUSES = ['pending', 'paid', 'overdue', 'cancelled'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PAYMENT_PLAN_STATUS_LABELS: Record<PaymentPlanStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
  defaulted: 'Incumplido',
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};

export interface PlanInstallmentInput {
  installmentNumber: number;
  dueDate: string;
  amount: number;
}

export interface PlanInstallmentRow {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  amount_paid?: number;
  status: InstallmentStatus | string;
}

export interface ActivePaymentPlan {
  id: string;
  title: string;
  status: PaymentPlanStatus | string;
  total_amount: number;
  installments: PlanInstallmentRow[];
  linked_charge_ids: string[];
}

export function paymentPlanStatusLabel(status: string): string {
  return PAYMENT_PLAN_STATUS_LABELS[status as PaymentPlanStatus] ?? status;
}

export function installmentStatusLabel(status: string): string {
  return INSTALLMENT_STATUS_LABELS[status as InstallmentStatus] ?? status;
}

export function installmentAmountPaid(installment: { amount_paid?: number }): number {
  return roundMoney(Number(installment.amount_paid ?? 0));
}

export function installmentBalanceDue(installment: {
  amount: number;
  amount_paid?: number;
  status: string;
}): number {
  if (installment.status === 'paid' || installment.status === 'cancelled') return 0;
  return roundMoney(Math.max(0, Number(installment.amount) - installmentAmountPaid(installment)));
}

export function splitInstallmentAmounts(totalAmount: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('El número de parcialidades debe ser al menos 1.');
  }
  const total = roundMoney(totalAmount);
  if (total <= 0) throw new Error('El monto total debe ser mayor a cero.');

  const base = roundMoney(total / count);
  const amounts = Array.from({ length: count }, () => base);
  const distributed = roundMoney(base * count);
  const remainder = roundMoney(total - distributed);
  amounts[count - 1] = roundMoney(amounts[count - 1]! + remainder);
  return amounts;
}

export function addMonthsToDate(isoDate: string, months: number): string {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildInstallmentSchedule(
  totalAmount: number,
  count: number,
  firstDueDate: string,
  intervalMonths = 1,
): PlanInstallmentInput[] {
  const amounts = splitInstallmentAmounts(totalAmount, count);
  return amounts.map((amount, index) => ({
    installmentNumber: index + 1,
    dueDate: addMonthsToDate(firstDueDate, index * intervalMonths),
    amount,
  }));
}

export function planInstallmentsPaidTotal(installments: PlanInstallmentRow[]): number {
  return roundMoney(
    installments.reduce((sum, row) => sum + installmentAmountPaid(row), 0),
  );
}

export function planInstallmentsProgress(installments: PlanInstallmentRow[]): {
  paidAmount: number;
  totalAmount: number;
  paidCount: number;
  totalCount: number;
  percent: number | null;
} {
  const totalAmount = roundMoney(installments.reduce((sum, row) => sum + Number(row.amount), 0));
  const paidAmount = planInstallmentsPaidTotal(installments);
  const paidCount = installments.filter((row) => row.status === 'paid').length;
  return {
    paidAmount,
    totalAmount,
    paidCount,
    totalCount: installments.length,
    percent: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : null,
  };
}

export function nextDueInstallment(
  installments: PlanInstallmentRow[],
): PlanInstallmentRow | null {
  const open = installments
    .filter((row) => installmentBalanceDue(row) > 0 && row.status !== 'cancelled')
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.installment_number - b.installment_number);
  return open[0] ?? null;
}

export interface PaymentTarget {
  kind: 'installment' | 'charges';
  chargeId: string;
  installmentId?: string;
  label: string;
  maxAmount: number;
  dueDate: string;
  installmentNumber?: number;
}

export function resolveNextPaymentTarget(
  charges: ChargeForSettlement[],
  plan: ActivePaymentPlan | null,
): PaymentTarget | null {
  if (plan?.status === 'active') {
    const installment = nextDueInstallment(plan.installments);
    if (installment) {
      const balance = installmentBalanceDue(installment);
      const primaryChargeId =
        plan.linked_charge_ids[0] ??
        charges.find((charge) => chargeBalanceDue(charge) > 0)?.id;
      if (!primaryChargeId || balance <= 0) return null;
      return {
        kind: 'installment',
        chargeId: primaryChargeId,
        installmentId: installment.id,
        label: `${plan.title} · Parcialidad ${installment.installment_number}`,
        maxAmount: balance,
        dueDate: installment.due_date,
        installmentNumber: installment.installment_number,
      };
    }
  }

  const unpaid = charges
    .filter((charge) => chargeBalanceDue(charge) > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id));
  const primary = unpaid[0];
  if (!primary) return null;

  return {
    kind: 'charges',
    chargeId: primary.id,
    label: 'Próximo cargo',
    maxAmount: chargeBalanceDue(primary),
    dueDate: primary.due_date,
  };
}

export function orderChargeIdsForPlan(
  chargeIds: string[],
  charges: ChargeForSettlement[],
): string[] {
  const chargeMap = new Map(charges.map((charge) => [charge.id, charge]));
  return [...chargeIds].sort((a, b) => {
    const ca = chargeMap.get(a);
    const cb = chargeMap.get(b);
    if (!ca || !cb) return a.localeCompare(b);
    return ca.due_date.localeCompare(cb.due_date) || a.localeCompare(b);
  });
}
