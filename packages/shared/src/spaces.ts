export interface SpacesSettings {
  block_reservations_if_overdue?: boolean;
  /** Enviar push/correo al residente cuando admin aprueba o cancela. */
  notify_reservation_updates?: boolean;
}

export interface AmenityReservationRules {
  booking_horizon_days: number;
  min_booking_lead_hours: number;
  min_cancel_lead_hours: number;
  /** Máx. reservas activas por unidad en esta amenidad (0 = sin límite). */
  max_active_reservations: number;
  blocked_dates: string[];
}

export const DEFAULT_BOOKING_HORIZON_DAYS = 7;
export const MIN_BOOKING_HORIZON_DAYS = 1;
export const MAX_BOOKING_HORIZON_DAYS = 90;

export const DEFAULT_MIN_BOOKING_LEAD_HOURS = 2;
export const DEFAULT_MIN_CANCEL_LEAD_HOURS = 24;
export const MAX_LEAD_HOURS = 168;

export function normalizeBookingHorizonDays(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BOOKING_HORIZON_DAYS;
  return Math.min(
    MAX_BOOKING_HORIZON_DAYS,
    Math.max(MIN_BOOKING_HORIZON_DAYS, Math.round(parsed)),
  );
}

export function normalizeLeadHours(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_LEAD_HOURS, Math.max(0, Math.round(parsed)));
}

export function normalizeMaxActiveReservations(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseBlockedDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (DATE_KEY_RE.test(trimmed)) unique.add(trimmed);
  }
  return [...unique].sort();
}

export function parseBlockedDatesInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parseBlockedDates(parts);
}

export function formatBlockedDatesForInput(dates: string[]): string {
  return dates.join('\n');
}

export function parseSpacesSettings(raw: unknown): SpacesSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const spaces = (raw as { spaces?: unknown }).spaces;
  if (!spaces || typeof spaces !== 'object' || Array.isArray(spaces)) return {};
  const typed = spaces as SpacesSettings;
  return {
    block_reservations_if_overdue: Boolean(typed.block_reservations_if_overdue),
    notify_reservation_updates: typed.notify_reservation_updates !== false,
  };
}

export function parseAmenityReservationRules(row: {
  booking_horizon_days?: unknown;
  min_booking_lead_hours?: unknown;
  min_cancel_lead_hours?: unknown;
  max_active_reservations?: unknown;
  blocked_dates?: unknown;
}): AmenityReservationRules {
  return {
    booking_horizon_days: normalizeBookingHorizonDays(row.booking_horizon_days),
    min_booking_lead_hours: normalizeLeadHours(
      row.min_booking_lead_hours,
      DEFAULT_MIN_BOOKING_LEAD_HOURS,
    ),
    min_cancel_lead_hours: normalizeLeadHours(
      row.min_cancel_lead_hours,
      DEFAULT_MIN_CANCEL_LEAD_HOURS,
    ),
    max_active_reservations: normalizeMaxActiveReservations(row.max_active_reservations),
    blocked_dates: parseBlockedDates(row.blocked_dates),
  };
}

export function bookingDayOptions(horizonDays: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = normalizeBookingHorizonDays(horizonDays);
  for (let i = 0; i < count; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    days.push(day);
  }
  return days;
}

export function isWithinBookingHorizon(date: Date, horizonDays: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(today.getDate() + normalizeBookingHorizonDays(horizonDays));
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return candidate >= today && candidate < limit;
}

export function isBlockedDate(date: Date, blockedDates: string[]): boolean {
  if (!blockedDates.length) return false;
  return blockedDates.includes(formatDateKey(date));
}

export function bookingDayOptionsFiltered(
  horizonDays: number,
  blockedDates: string[],
): Date[] {
  return bookingDayOptions(horizonDays).filter((day) => !isBlockedDate(day, blockedDates));
}

export function meetsMinBookingLead(
  startsAt: Date,
  leadHours: number,
  now: Date = new Date(),
): boolean {
  const hours = normalizeLeadHours(leadHours, 0);
  if (hours <= 0) return true;
  return startsAt.getTime() - now.getTime() >= hours * 60 * 60 * 1000;
}

export function canCancelByLead(
  startsAt: Date,
  leadHours: number,
  now: Date = new Date(),
): boolean {
  const hours = normalizeLeadHours(leadHours, 0);
  if (hours <= 0) return true;
  return startsAt.getTime() - now.getTime() >= hours * 60 * 60 * 1000;
}

export function minBookingLeadMessage(leadHours: number): string {
  const hours = normalizeLeadHours(leadHours, 0);
  if (hours <= 0) return '';
  if (hours < 24) {
    return `Debes reservar al menos ${hours} hora(s) antes del horario.`;
  }
  const days = Math.round(hours / 24);
  return `Debes reservar al menos ${days} día(s) antes del horario.`;
}

export function minCancelLeadMessage(leadHours: number): string {
  const hours = normalizeLeadHours(leadHours, 0);
  if (hours <= 0) return '';
  if (hours < 24) {
    return `Solo puedes cancelar hasta ${hours} hora(s) antes del inicio.`;
  }
  const days = Math.round(hours / 24);
  return `Solo puedes cancelar hasta ${days} día(s) antes del inicio.`;
}

/** General amenity (no cluster) is visible to all units; cluster amenity only to matching tower. */
export function amenityAppliesToUnitCluster(
  amenityClusterId: string | null | undefined,
  unitClusterId: string | null | undefined,
): boolean {
  if (!amenityClusterId) return true;
  return Boolean(unitClusterId && amenityClusterId === unitClusterId);
}

export function amenityScopeLabel(
  clusterId: string | null | undefined,
  clusterName?: string | null,
): string {
  if (!clusterId) return 'Todo el fraccionamiento';
  return clusterName ?? 'Torre / cluster';
}

export interface BookedSlot {
  starts_at: string;
  ends_at: string;
}

export function countOverlappingBookings(
  booked: BookedSlot[],
  startsAt: Date,
  endsAt: Date,
): number {
  return booked.filter((row) => {
    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    return startsAt < end && endsAt > start;
  }).length;
}

export function slotHasCapacity(
  booked: BookedSlot[],
  startsAt: Date,
  endsAt: Date,
  maxConcurrent: number,
): boolean {
  return countOverlappingBookings(booked, startsAt, endsAt) < Math.max(1, maxConcurrent);
}
