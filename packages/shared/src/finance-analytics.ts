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
