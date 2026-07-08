export interface SecuritySettings {
  /** Bloquea pases de renta si la unidad tiene cuotas de mantenimiento vencidas. */
  block_rental_visits_if_overdue?: boolean;
}

export const RENTAL_OVERDUE_BLOCK_MESSAGE =
  'No puedes registrar rentas mientras tengas adeudos de mantenimiento.';

export const DEFAULT_RENTAL_STAY_DAYS = 2;
export const MIN_RENTAL_STAY_DAYS = 1;
export const MAX_RENTAL_STAY_DAYS = 30;

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
  start = new Date(),
): { validFrom: string; validUntil: string } {
  const days = normalizeStayDays(stayDays);
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const until = new Date(from);
  until.setDate(until.getDate() + days - 1);
  until.setHours(23, 59, 59, 999);
  return { validFrom: from.toISOString(), validUntil: until.toISOString() };
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
