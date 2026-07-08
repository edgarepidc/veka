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
  images?: { id: string; image_url: string; caption: string | null; sort_order: number }[];
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
