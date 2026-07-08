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

export function previousFinancePeriodStart(period: FinancePeriod): Date | null {
  if (period === 'all') return null;
  const currentStart = financePeriodStart(period);
  if (!currentStart) return null;
  const prev = new Date(currentStart);
  if (period === '1m') {
    prev.setMonth(prev.getMonth() - 1);
  } else {
    prev.setMonth(prev.getMonth() - 3);
  }
  return prev;
}

export function inPreviousFinancePeriod(dateIso: string, period: FinancePeriod): boolean {
  if (period === 'all') return false;
  const prevStart = previousFinancePeriodStart(period);
  const currentStart = financePeriodStart(period);
  if (!prevStart || !currentStart) return false;
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) return false;
  return value >= prevStart && value < currentStart;
}
