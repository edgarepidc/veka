export type PeriodMode = 'month' | 'year';

export function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function dateInYear(isoDate: string, year: number): boolean {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  return d.getFullYear() === year;
}

export function dateInMonth(isoDate: string, year: number, month: number): boolean {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

export function dateOnOrBefore(isoDate: string, reference: Date): boolean {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  const ref = new Date(reference);
  ref.setHours(23, 59, 59, 999);
  return d.getTime() <= ref.getTime();
}

/** Cash-basis period filter. Year mode for the current fiscal year is YTD (through reference). */
export function inFinancePeriod(
  isoDate: string,
  periodMode: PeriodMode,
  year: number,
  month: number,
  reference = new Date(),
): boolean {
  if (periodMode === 'month') {
    return dateInMonth(isoDate, year, month);
  }
  if (!dateInYear(isoDate, year)) return false;
  if (year === reference.getFullYear()) {
    return dateOnOrBefore(isoDate, reference);
  }
  return true;
}

/** Prior period for YoY/MoM deltas — year mode uses the same YTD cutoff in the previous year. */
export function inComparablePreviousPeriod(
  isoDate: string,
  periodMode: PeriodMode,
  year: number,
  month: number,
  reference = new Date(),
): boolean {
  if (periodMode === 'month') {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    return dateInMonth(isoDate, prevYear, prevMonth);
  }
  const prevYear = year - 1;
  if (!dateInYear(isoDate, prevYear)) return false;
  if (year === reference.getFullYear()) {
    const cutoff = new Date(reference);
    cutoff.setFullYear(prevYear);
    return dateOnOrBefore(isoDate, cutoff);
  }
  return true;
}

export function paymentPeriodDate(paidAt: string | null, createdAt: string): string {
  return paidAt ?? createdAt;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function applyCoefficient(baseAmount: number, coefficient: number): number {
  return roundMoney(baseAmount * coefficient);
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface ChartBar {
  label: string;
  value: number;
  meta?: string;
}

export const EXPENSE_CHART_COLORS = [
  '#34d399',
  '#60a5fa',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#fb923c',
  '#2dd4bf',
  '#94a3b8',
];
