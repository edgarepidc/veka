import type { MaintenanceRecurrence } from './constants';

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

export const RECURRENCE_LABELS: Record<MaintenanceRecurrence, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  on_demand: 'A demanda',
};

export interface MaintenanceRoutineRef {
  id: string;
  title: string;
  description: string | null;
  day_of_week: number | null;
  recurrence: MaintenanceRecurrence;
  monthly_day: number | null;
  anchor_date: string | null;
  sort_order: number;
  amenity?: { name: string } | null;
  evidence?: MaintenanceRoutineEvidenceRef[];
}

export function weekdayLabel(day: number | null | undefined): string {
  if (day == null) return 'A demanda';
  return WEEKDAY_LABELS[day] ?? '—';
}

export function recurrenceLabel(recurrence: MaintenanceRecurrence): string {
  return RECURRENCE_LABELS[recurrence];
}

export function parseRoutineImageUrlsFromForm(formData: FormData, field = 'image_urls'): string[] {
  return [...new Set(formData.getAll(field).map((value) => String(value).trim()).filter(Boolean))];
}

export type MaintenancePeriodFilter = 'month' | 'quarter' | 'all';

export const MAINTENANCE_PERIOD_LABELS: Record<MaintenancePeriodFilter, string> = {
  month: 'Mes actual',
  quarter: 'Últimos 3 meses',
  all: 'Histórico',
};

export interface MaintenanceRoutineEvidenceRef {
  id: string;
  evidence_date: string;
  image_url: string;
  sort_order: number;
}

export function isDateInMaintenancePeriod(dateStr: string, period: MaintenancePeriodFilter): boolean {
  const date = new Date(`${dateStr}T12:00:00`);
  const now = new Date();
  if (period === 'all') return true;
  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);
  return date >= threeMonthsAgo;
}

export function formatEvidenceDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function evidenceGroupLabel(dateStr: string): string {
  return `Evidencia — ${formatEvidenceDateLabel(dateStr)}`;
}

export function groupEvidenceByDate<T extends { evidence_date: string; sort_order: number }>(
  evidence: T[],
  period: MaintenancePeriodFilter,
): { date: string; label: string; items: T[] }[] {
  const filtered = evidence.filter((item) => isDateInMaintenancePeriod(item.evidence_date, period));
  const byDate = new Map<string, T[]>();

  for (const item of filtered) {
    const list = byDate.get(item.evidence_date) ?? [];
    list.push(item);
    byDate.set(item.evidence_date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      label: evidenceGroupLabel(date),
      items: items.sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export function groupRoutinesByWeekday<
  T extends { day_of_week: number | null; sort_order: number; recurrence: MaintenanceRecurrence },
>(routines: T[]): { weekday: number | null; label: string; items: T[] }[] {
  const onDemand = routines
    .filter((routine) => routine.day_of_week == null || routine.recurrence === 'on_demand')
    .sort((a, b) => a.sort_order - b.sort_order);

  const groups: { weekday: number | null; label: string; items: T[] }[] = WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    items: routines
      .filter((routine) => routine.day_of_week === weekday && routine.recurrence !== 'on_demand')
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  if (onDemand.length > 0) {
    groups.push({ weekday: null, label: 'A demanda', items: onDemand });
  }

  return groups;
}
