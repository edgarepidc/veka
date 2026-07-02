import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface Amenity {
  id: string;
  name: string;
  description: string | null;
  max_daily_reservations: number;
  max_monthly_reservations: number;
  slot_duration_minutes: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

export interface Reservation {
  id: string;
  amenity_id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  amenity?: { name: string } | { name: string }[] | null;
}

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
  label: string;
  available: boolean;
}

function amenityName(reservation: Reservation): string {
  const amenity = reservation.amenity;
  if (!amenity) return 'Espacio';
  return Array.isArray(amenity) ? (amenity[0]?.name ?? 'Espacio') : amenity.name;
}

function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

export function buildSlotsForDay(
  amenity: Amenity,
  day: Date,
  booked: { starts_at: string; ends_at: string }[],
): TimeSlot[] {
  const open = parseTimeOnDate(amenity.open_time, day);
  const close = parseTimeOnDate(amenity.close_time, day);
  const durationMs = amenity.slot_duration_minutes * 60 * 1000;
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (let start = open.getTime(); start + durationMs <= close.getTime(); start += durationMs) {
    const startsAt = new Date(start);
    const endsAt = new Date(start + durationMs);
    const taken = booked.some((row) =>
      overlaps(startsAt, endsAt, new Date(row.starts_at), new Date(row.ends_at)),
    );
    const inPast = endsAt <= now;
    slots.push({
      startsAt,
      endsAt,
      label: new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(startsAt),
      available: !taken && !inPast,
    });
  }

  return slots;
}

export function useSpaces(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id || !user) {
      setAmenities([]);
      setReservations([]);
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();

    const [amenitiesRes, reservationsRes] = await Promise.all([
      supabase
        .from('amenities')
        .select(
          'id, name, description, max_daily_reservations, max_monthly_reservations, slot_duration_minutes, open_time, close_time, is_active',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('reservations')
        .select('id, amenity_id, starts_at, ends_at, status, amenity:amenities (name)')
        .eq('unit_id', primary.unit_id)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true }),
    ]);

    setAmenities((amenitiesRes.data as Amenity[]) ?? []);
    setReservations((reservationsRes.data as Reservation[]) ?? []);
    setLoading(false);
  }, [primary, user]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const fetchBookedSlots = useCallback(
    async (amenityId: string, day: Date) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('reservations')
        .select('starts_at, ends_at')
        .eq('amenity_id', amenityId)
        .eq('status', 'confirmed')
        .gte('starts_at', dayStart.toISOString())
        .lte('starts_at', dayEnd.toISOString());

      return data ?? [];
    },
    [],
  );

  const canBook = useCallback(
    async (amenity: Amenity, startsAt: Date) => {
      if (!user || !primary?.unit_id) {
        return { ok: false, message: 'Debes tener una unidad asignada.' };
      }

      const dayStart = new Date(startsAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(startsAt);
      dayEnd.setHours(23, 59, 59, 999);

      const monthStart = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
      const monthEnd = new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 0, 23, 59, 59);

      const { data: sameDay } = await supabase
        .from('reservations')
        .select('id')
        .eq('amenity_id', amenity.id)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('starts_at', dayStart.toISOString())
        .lte('starts_at', dayEnd.toISOString());

      if ((sameDay?.length ?? 0) >= amenity.max_daily_reservations) {
        return {
          ok: false,
          message: `Límite diario: ${amenity.max_daily_reservations} reserva(s) para ${amenity.name}.`,
        };
      }

      const { data: sameMonth } = await supabase
        .from('reservations')
        .select('id')
        .eq('amenity_id', amenity.id)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString());

      if ((sameMonth?.length ?? 0) >= amenity.max_monthly_reservations) {
        return {
          ok: false,
          message: `Límite mensual: ${amenity.max_monthly_reservations} reserva(s) para ${amenity.name}.`,
        };
      }

      return { ok: true, message: null };
    },
    [primary?.unit_id, user],
  );

  const createReservation = useCallback(
    async (amenity: Amenity, startsAt: Date, endsAt: Date) => {
      if (!user || !primary?.condominium_id || !primary.unit_id) {
        return { error: 'Sin unidad asignada.' };
      }

      setActionError(null);
      const limitCheck = await canBook(amenity, startsAt);
      if (!limitCheck.ok) {
        setActionError(limitCheck.message);
        return { error: limitCheck.message };
      }

      const booked = await fetchBookedSlots(amenity.id, startsAt);
      if (booked.some((row) => overlaps(startsAt, endsAt, new Date(row.starts_at), new Date(row.ends_at)))) {
        const message = 'Ese horario ya no está disponible.';
        setActionError(message);
        return { error: message };
      }

      const { error } = await supabase.from('reservations').insert({
        amenity_id: amenity.id,
        condominium_id: primary.condominium_id,
        unit_id: primary.unit_id,
        user_id: user.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'confirmed',
      });

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [canBook, fetchBookedSlots, primary, refresh, user],
  );

  const cancelReservation = useCallback(
    async (reservationId: string) => {
      setActionError(null);
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId);

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const clearActionError = useCallback(() => setActionError(null), []);

  return {
    amenities,
    reservations,
    loading,
    refreshing,
    actionError,
    clearActionError,
    refresh,
    fetchBookedSlots,
    createReservation,
    cancelReservation,
    amenityName,
  };
}
