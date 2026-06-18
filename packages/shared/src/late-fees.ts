import type { FundType } from './constants';
import { roundMoney } from './finance-analytics';
import { daysPastDue } from './finance-dashboard';

export const LATE_FEE_TYPES = ['fixed', 'percent'] as const;
export type LateFeeType = (typeof LATE_FEE_TYPES)[number];

export const LATE_FEE_APPLY_MODES = ['once', 'monthly'] as const;
export type LateFeeApplyMode = (typeof LATE_FEE_APPLY_MODES)[number];

export const CHARGE_KINDS = ['principal', 'late_fee'] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export interface LateFeeSettings {
  enabled: boolean;
  grace_days: number;
  fee_type: LateFeeType;
  fee_value: number;
  apply_mode: LateFeeApplyMode;
  fund_type: FundType;
  notes?: string | null;
}

export interface ChargeForLateFee {
  id: string;
  unit_id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: string;
  charge_kind: string;
  fund_type: FundType;
}

export interface ExistingLateFee {
  id: string;
  parent_charge_id: string | null;
  period_month: string | null;
}

export function lateFeeTypeLabel(type: LateFeeType): string {
  return type === 'fixed' ? 'Monto fijo' : 'Porcentaje del cargo';
}

export function lateFeeApplyModeLabel(mode: LateFeeApplyMode): string {
  return mode === 'once' ? 'Una sola vez por cargo' : 'Mensual mientras siga vencido';
}

export function chargeKindLabel(kind: string): string {
  return kind === 'late_fee' ? 'Recargo por mora' : 'Cargo principal';
}

export function periodMonthFromDate(isoDate: string): string {
  const date = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0);
}

export function formatPeriodMonthLabel(periodMonth: string): string {
  const date = new Date(periodMonth.includes('T') ? periodMonth : `${periodMonth}T12:00:00`);
  return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

export function buildLateFeeConcept(parentConcept: string, periodMonth?: string | null): string {
  if (periodMonth) {
    return `Recargo por mora — ${parentConcept} (${formatPeriodMonthLabel(periodMonth)})`;
  }
  return `Recargo por mora — ${parentConcept}`;
}

export function computeLateFeeAmount(principalAmount: number, settings: LateFeeSettings): number {
  if (!settings.enabled || settings.fee_value <= 0) return 0;
  if (settings.fee_type === 'fixed') return roundMoney(settings.fee_value);
  return roundMoney(principalAmount * (settings.fee_value / 100));
}

export function isPrincipalChargeEligible(
  charge: Pick<ChargeForLateFee, 'status' | 'due_date' | 'charge_kind'>,
  settings: LateFeeSettings,
  reference = new Date(),
): boolean {
  if (!settings.enabled) return false;
  if (charge.charge_kind !== 'principal') return false;
  if (charge.status !== 'overdue' && charge.status !== 'pending') return false;
  return daysPastDue(charge.due_date, reference) > settings.grace_days;
}

export function eligibleLateFeePeriods(
  dueDate: string,
  graceDays: number,
  applyMode: LateFeeApplyMode,
  reference = new Date(),
): string[] {
  const due = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T12:00:00`);
  const firstEligible = new Date(due);
  firstEligible.setDate(firstEligible.getDate() + graceDays + 1);

  if (firstEligible.getTime() > reference.getTime()) return [];

  const firstMonth = startOfMonth(firstEligible.getFullYear(), firstEligible.getMonth() + 1);
  const lastMonth = startOfMonth(reference.getFullYear(), reference.getMonth() + 1);

  const periods: string[] = [];
  let cursor = firstMonth;
  while (cursor.getTime() <= lastMonth.getTime()) {
    periods.push(periodMonthFromDate(cursor.toISOString().slice(0, 10)));
    if (applyMode === 'once') break;
    cursor = addMonths(cursor, 1);
  }

  return periods;
}

export function lateFeesToCreate(
  principal: ChargeForLateFee,
  settings: LateFeeSettings,
  existingLateFees: ExistingLateFee[],
  reference = new Date(),
): { periodMonth: string | null; amount: number; concept: string }[] {
  if (!isPrincipalChargeEligible(principal, settings, reference)) return [];

  const amount = computeLateFeeAmount(Number(principal.amount), settings);
  if (amount <= 0) return [];

  const periods = eligibleLateFeePeriods(
    principal.due_date,
    settings.grace_days,
    settings.apply_mode,
    reference,
  );

  const existingPeriods = new Set(
    existingLateFees
      .filter((fee) => fee.parent_charge_id === principal.id)
      .map((fee) => fee.period_month ?? 'once'),
  );

  return periods
    .filter((periodMonth) => !existingPeriods.has(periodMonth))
    .map((periodMonth) => ({
      periodMonth,
      amount,
      concept: buildLateFeeConcept(principal.concept, settings.apply_mode === 'monthly' ? periodMonth : null),
    }));
}

export function describeLateFeeSettings(settings: LateFeeSettings): string {
  if (!settings.enabled) return 'Recargos por mora desactivados.';
  const amountLabel =
    settings.fee_type === 'fixed'
      ? `$${settings.fee_value.toFixed(2)}`
      : `${settings.fee_value}% del cargo`;
  return `${amountLabel} después de ${settings.grace_days} día${
    settings.grace_days === 1 ? '' : 's'
  } de gracia · ${lateFeeApplyModeLabel(settings.apply_mode).toLowerCase()}`;
}
