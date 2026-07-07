export interface SpacesSettings {
  block_reservations_if_overdue?: boolean;
}

export function parseSpacesSettings(raw: unknown): SpacesSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const spaces = (raw as { spaces?: unknown }).spaces;
  if (!spaces || typeof spaces !== 'object' || Array.isArray(spaces)) return {};
  return {
    block_reservations_if_overdue: Boolean(
      (spaces as SpacesSettings).block_reservations_if_overdue,
    ),
  };
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
