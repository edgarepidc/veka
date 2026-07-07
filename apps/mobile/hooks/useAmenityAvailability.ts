import { useEffect, useState } from 'react';
import {
  countAvailableSlots,
  formatTodayAvailabilityLabel,
  isBlockedDate,
  isWithinBookingHorizon,
} from '@veka/shared';

import { buildSlotsForDay, type Amenity } from '@/hooks/useSpaces';

export async function getTodayAvailabilityLabel(
  amenity: Amenity,
  fetchBookedSlots: (amenityId: string, day: Date) => Promise<{ starts_at: string; ends_at: string }[]>,
  day: Date = new Date(),
): Promise<string> {
  const today = new Date(day);
  today.setHours(0, 0, 0, 0);

  if (!isWithinBookingHorizon(today, amenity.booking_horizon_days)) {
    return 'No disponible hoy';
  }
  if (isBlockedDate(today, amenity.blocked_dates)) {
    return 'No disponible hoy';
  }

  const booked = await fetchBookedSlots(amenity.id, today);
  const slots = buildSlotsForDay(amenity, today, booked, amenity.min_booking_lead_hours);
  return formatTodayAvailabilityLabel(countAvailableSlots(slots));
}

export function useAmenityAvailability(
  amenities: Amenity[],
  fetchBookedSlots: (amenityId: string, day: Date) => Promise<{ starts_at: string; ends_at: string }[]>,
) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!amenities.length) {
      setLabels({});
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const entries = await Promise.all(
        amenities.map(async (amenity) => {
          const label = await getTodayAvailabilityLabel(amenity, fetchBookedSlots);
          return [amenity.id, label] as const;
        }),
      );

      if (!cancelled) {
        setLabels(Object.fromEntries(entries));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [amenities, fetchBookedSlots]);

  return { availabilityLabels: labels, availabilityLoading: loading };
}
