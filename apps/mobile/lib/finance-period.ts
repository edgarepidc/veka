export type FinancePeriod = '1m' | '3m' | 'all';

export const FINANCE_PERIOD_OPTIONS: { key: FinancePeriod; label: string }[] = [
  { key: '1m', label: 'Último mes' },
  { key: '3m', label: '3 meses' },
  { key: 'all', label: 'Histórico' },
];

export function financePeriodStart(period: FinancePeriod): Date | null {
  if (period === 'all') return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === '1m') {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setMonth(start.getMonth() - 3);
  }
  return start;
}

export function inFinancePeriod(dateIso: string, period: FinancePeriod): boolean {
  const start = financePeriodStart(period);
  if (!start) return true;
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) return false;
  return value >= start;
}

export function financePeriodLabel(period: FinancePeriod): string {
  return FINANCE_PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? 'Período';
}
