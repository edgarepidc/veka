export interface SpacesSettings {
  block_reservations_if_overdue?: boolean;
  /** Días calendario disponibles para reservar, incluyendo hoy. */
  booking_horizon_days?: number;
}

export const DEFAULT_BOOKING_HORIZON_DAYS = 7;
export const MIN_BOOKING_HORIZON_DAYS = 1;
export const MAX_BOOKING_HORIZON_DAYS = 90;

export function normalizeBookingHorizonDays(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BOOKING_HORIZON_DAYS;
  return Math.min(
    MAX_BOOKING_HORIZON_DAYS,
    Math.max(MIN_BOOKING_HORIZON_DAYS, Math.round(parsed)),
  );
}

export function parseSpacesSettings(raw: unknown): SpacesSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const spaces = (raw as { spaces?: unknown }).spaces;
  if (!spaces || typeof spaces !== 'object' || Array.isArray(spaces)) return {};
  const typed = spaces as SpacesSettings;
  return {
    block_reservations_if_overdue: Boolean(typed.block_reservations_if_overdue),
    booking_horizon_days: normalizeBookingHorizonDays(typed.booking_horizon_days),
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
