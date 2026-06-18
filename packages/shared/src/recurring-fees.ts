import type { RecurringFeeStatus } from './constants';
import { applyCoefficient } from './finance-analytics';

export const RECURRING_FEE_STATUS_LABELS: Record<RecurringFeeStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

export interface FeeRevision {
  base_amount: number;
  effective_from: string;
}

export function recurringFeeStatusLabel(status: RecurringFeeStatus): string {
  return RECURRING_FEE_STATUS_LABELS[status];
}

export function monthStartFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function currentPeriodMonth(date = new Date()): string {
  return monthStartFromParts(date.getFullYear(), date.getMonth() + 1);
}

export function nextPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  const d = new Date(y!, m!, 1);
  d.setMonth(d.getMonth() + 1);
  return monthStartFromParts(d.getFullYear(), d.getMonth() + 1);
}

export function dueDateInMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dueDateForPeriodMonth(periodMonth: string, dueDay: number): string {
  const [year, month] = periodMonth.split('-').map(Number);
  return dueDateInMonth(year!, month!, dueDay);
}

export function resolveBaseAmount(revisions: FeeRevision[], periodMonth: string): number {
  if (revisions.length === 0) return 0;
  const sorted = [...revisions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  const match = sorted.find((revision) => revision.effective_from <= periodMonth);
  return Number(match?.base_amount ?? sorted[sorted.length - 1]!.base_amount);
}

export function unitChargeAmount(baseAmount: number, coefficient: number): number {
  return applyCoefficient(baseAmount, coefficient);
}

export function periodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-').map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}
