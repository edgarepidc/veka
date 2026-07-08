import { formatDateKey } from './spaces';

export interface SecuritySettings {
  /** Bloquea pases de renta si la unidad tiene cuotas de mantenimiento vencidas. */
  block_rental_visits_if_overdue?: boolean;
}

export const RENTAL_OVERDUE_BLOCK_MESSAGE =
  'No puedes registrar rentas mientras tengas adeudos de mantenimiento.';

export const DEFAULT_RENTAL_STAY_DAYS = 2;
export const MIN_RENTAL_STAY_DAYS = 1;
export const MAX_RENTAL_STAY_DAYS = 30;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayDateKey(): string {
  return formatDateKey(new Date());
}

export function parseVisitDateKey(dateKey: string): Date {
  if (!DATE_KEY_RE.test(dateKey)) {
    return new Date();
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isDateKeyBeforeToday(dateKey: string): boolean {
  return compareDateKeys(dateKey, todayDateKey()) < 0;
}

export function endDateKeyFromStartAndStayDays(startKey: string, stayDays: number): string {
  const days = normalizeStayDays(stayDays);
  const end = parseVisitDateKey(startKey);
  end.setDate(end.getDate() + days - 1);
  return formatDateKey(end);
}

export function stayDaysInDateRange(startKey: string, endKey: string): number {
  const start = parseVisitDateKey(startKey);
  const end = parseVisitDateKey(endKey);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

/** Inclusive calendar range from date keys (local day boundaries). */
export function visitWindowFromDateRange(
  startKey: string,
  endKey: string,
): { validFrom: string; validUntil: string } {
  const orderedStart = compareDateKeys(startKey, endKey) <= 0 ? startKey : endKey;
  const orderedEnd = compareDateKeys(startKey, endKey) <= 0 ? endKey : startKey;
  const from = parseVisitDateKey(orderedStart);
  from.setHours(0, 0, 0, 0);
  const until = parseVisitDateKey(orderedEnd);
  until.setHours(23, 59, 59, 999);
  return { validFrom: from.toISOString(), validUntil: until.toISOString() };
}

export function formatVisitDateRangeLabel(startKey: string, endKey: string): string {
  const start = parseVisitDateKey(startKey);
  const end = parseVisitDateKey(endKey);
  const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
  if (startKey === endKey) return fmt.format(start);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function parseSecuritySettings(raw: unknown): SecuritySettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const typed = raw as SecuritySettings;
  return {
    block_rental_visits_if_overdue: Boolean(typed.block_rental_visits_if_overdue),
  };
}

export function condoBlocksRentalVisitsIfOverdue(settings: SecuritySettings | undefined): boolean {
  return Boolean(settings?.block_rental_visits_if_overdue);
}

export function normalizeStayDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_RENTAL_STAY_DAYS;
  return Math.min(MAX_RENTAL_STAY_DAYS, Math.max(MIN_RENTAL_STAY_DAYS, Math.round(parsed)));
}

/** Inclusive stay window: day 1 through stayDays at end of last day. */
export function rentalVisitWindow(
  stayDays: number,
  start: Date | string = new Date(),
): { validFrom: string; validUntil: string } {
  const startKey = typeof start === 'string' ? start : formatDateKey(start);
  const endKey = endDateKeyFromStartAndStayDays(startKey, stayDays);
  return visitWindowFromDateRange(startKey, endKey);
}

export function formatVisitVehicle(
  plate: string | null | undefined,
  model: string | null | undefined,
): string | null {
  const parts = [model?.trim(), plate?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function isRentalBlockedOverdueError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('adeudos') || lower.includes('rental_blocked_overdue');
}
