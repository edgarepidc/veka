import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  amenityAppliesToUnitCluster,
  canCancelByLead,
  isBlockedDate,
  isDelinquentCharge,
  isWithinBookingHorizon,
  meetsMinBookingLead,
  minBookingLeadMessage,
  minCancelLeadMessage,
  parseAmenityReservationRules,
  parseSpacesSettings,
  slotHasCapacity,
} from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface Amenity {
  id: string;
  name: string;
  description: string | null;
  cluster_id: string | null;
  cluster_name: string | null;
  image_url: string | null;
  max_daily_reservations: number;
  max_monthly_reservations: number;
  max_concurrent_reservations: number;
  booking_horizon_days: number;
  min_booking_lead_hours: number;
  min_cancel_lead_hours: number;
  max_active_reservations: number;
  blocked_dates: string[];
  slot_duration_minutes: number;
  open_time: string;
  close_time: string;
  requires_approval: boolean;
  restrict_if_overdue: boolean;
  is_active: boolean;
}

export interface Reservation {
  id: string;
  amenity_id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'pending';
  amenity?: { name: string; image_url: string | null } | { name: string; image_url: string | null }[] | null;
}

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
  label: string;
  available: boolean;
}

function amenityFromReservation(reservation: Reservation): { name: string; image_url: string | null } | null {
  const amenity = reservation.amenity;
  if (!amenity) return null;
  return Array.isArray(amenity) ? (amenity[0] ?? null) : amenity;
}

function amenityName(reservation: Reservation): string {
  return amenityFromReservation(reservation)?.name ?? 'Espacio';
}

function amenityImageUrl(reservation: Reservation): string | null {
  return amenityFromReservation(reservation)?.image_url ?? null;
}

function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function buildSlotsForDay(
  amenity: Amenity,
  day: Date,
  booked: { starts_at: string; ends_at: string }[],
  minBookingLeadHours = 0,
): TimeSlot[] {
  const open = parseTimeOnDate(amenity.open_time, day);
  const close = parseTimeOnDate(amenity.close_time, day);
  const durationMs = amenity.slot_duration_minutes * 60 * 1000;
  const slots: TimeSlot[] = [];
  const now = new Date();
  const maxConcurrent = amenity.max_concurrent_reservations ?? 1;

  for (let start = open.getTime(); start + durationMs <= close.getTime(); start += durationMs) {
    const startsAt = new Date(start);
    const endsAt = new Date(start + durationMs);
    const hasCapacity = slotHasCapacity(booked, startsAt, endsAt, maxConcurrent);
    const inPast = endsAt <= now;
    const meetsLead = meetsMinBookingLead(startsAt, minBookingLeadHours, now);
    slots.push({
      startsAt,
      endsAt,
      label: new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(startsAt),
      available: hasCapacity && !inPast && meetsLead,
    });
  }

  return slots;
}

export function useSpaces(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockIfOverdue, setBlockIfOverdue] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'general' | 'cluster'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const unitClusterId = primary?.unit?.cluster?.id ?? null;
  const unitClusterName = primary?.unit?.cluster?.name ?? null;

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id || !user) {
      setAmenities([]);
      setReservations([]);
      setBlockIfOverdue(false);
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();

    const [amenitiesRes, reservationsRes, condoRes] = await Promise.all([
      supabase
        .from('amenities')
        .select(
          'id, name, description, cluster_id, image_url, max_daily_reservations, max_monthly_reservations, max_concurrent_reservations, booking_horizon_days, min_booking_lead_hours, min_cancel_lead_hours, max_active_reservations, blocked_dates, slot_duration_minutes, open_time, close_time, requires_approval, restrict_if_overdue, is_active, cluster:clusters(name)',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('reservations')
        .select('id, amenity_id, starts_at, ends_at, status, amenity:amenities (name, image_url)')
        .eq('unit_id', primary.unit_id)
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .gte('ends_at', now)
        .order('starts_at', { ascending: true }),
      supabase.from('condominiums').select('settings').eq('id', primary.condominium_id).maybeSingle(),
      supabase
        .from('charges')
        .select('due_date, status, amount, amount_paid')
        .eq('unit_id', primary.unit_id)
        .in('status', ['pending', 'overdue']),
    ]);

    const parsedSpacesSettings = parseSpacesSettings(condoRes.data?.settings);
    setBlockIfOverdue(Boolean(parsedSpacesSettings.block_reservations_if_overdue));

    const rawAmenities =
      (amenitiesRes.data as {
        id: string;
        name: string;
        description: string | null;
        cluster_id: string | null;
        image_url: string | null;
        max_daily_reservations: number;
        max_monthly_reservations: number;
        max_concurrent_reservations: number;
        booking_horizon_days: number;
        min_booking_lead_hours: number;
        min_cancel_lead_hours: number;
        max_active_reservations: number;
        blocked_dates: string[] | null;
        slot_duration_minutes: number;
        open_time: string;
        close_time: string;
        requires_approval: boolean;
        restrict_if_overdue: boolean;
        is_active: boolean;
        cluster: { name: string } | { name: string }[] | null;
      }[] | null) ?? [];

    setAmenities(
      rawAmenities
        .filter((row) => amenityAppliesToUnitCluster(row.cluster_id, unitClusterId))
        .map((row) => {
          const rules = parseAmenityReservationRules(row);
          return {
            id: row.id,
            name: row.name,
            description: row.description,
            cluster_id: row.cluster_id,
            cluster_name: Array.isArray(row.cluster) ? (row.cluster[0]?.name ?? null) : (row.cluster?.name ?? null),
            image_url: row.image_url,
            max_daily_reservations: row.max_daily_reservations,
            max_monthly_reservations: row.max_monthly_reservations,
            max_concurrent_reservations: row.max_concurrent_reservations ?? 1,
            booking_horizon_days: rules.booking_horizon_days,
            min_booking_lead_hours: rules.min_booking_lead_hours,
            min_cancel_lead_hours: rules.min_cancel_lead_hours,
            max_active_reservations: rules.max_active_reservations,
            blocked_dates: rules.blocked_dates,
            slot_duration_minutes: row.slot_duration_minutes,
            open_time: row.open_time,
            close_time: row.close_time,
            requires_approval: row.requires_approval,
            restrict_if_overdue: row.restrict_if_overdue,
            is_active: row.is_active,
          };
        }),
    );

    setReservations((reservationsRes.data as Reservation[]) ?? []);
    setLoading(false);
  }, [primary, unitClusterId, user]);

  const hasOutstandingDebt = useCallback(async () => {
    if (!primary?.unit_id) return false;

    const { data } = await supabase
      .from('charges')
      .select('due_date, status, amount, amount_paid')
      .eq('unit_id', primary.unit_id)
      .in('status', ['pending', 'overdue']);

    return (data ?? []).some((charge) => isDelinquentCharge(charge));
  }, [primary?.unit_id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visibleAmenities = useMemo(() => {
    if (scopeFilter === 'general') {
      return amenities.filter((amenity) => !amenity.cluster_id);
    }
    if (scopeFilter === 'cluster' && unitClusterId) {
      return amenities.filter((amenity) => amenity.cluster_id === unitClusterId);
    }
    return amenities;
  }, [amenities, scopeFilter, unitClusterId]);

  const fetchBookedSlots = useCallback(async (amenityId: string, day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('reservations')
      .select('starts_at, ends_at')
      .eq('amenity_id', amenityId)
      .in('status', ['confirmed', 'pending'])
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString());

    return data ?? [];
  }, []);

  const canBook = useCallback(
    async (amenity: Amenity, startsAt: Date, endsAt: Date) => {
      if (!user || !primary?.unit_id) {
        return { ok: false, message: 'Debes tener una unidad asignada.' };
      }

      if (isBlockedDate(startsAt, amenity.blocked_dates)) {
        return { ok: false, message: 'Ese día está bloqueado para reservas en este espacio.' };
      }

      if (!isWithinBookingHorizon(startsAt, amenity.booking_horizon_days)) {
        return {
          ok: false,
          message: `Solo puedes reservar con hasta ${amenity.booking_horizon_days} día(s) de anticipación en ${amenity.name}.`,
        };
      }

      if (!meetsMinBookingLead(startsAt, amenity.min_booking_lead_hours)) {
        return {
          ok: false,
          message: minBookingLeadMessage(amenity.min_booking_lead_hours),
        };
      }

      if (amenity.max_active_reservations > 0) {
        const nowIso = new Date().toISOString();
        const { data: activeForUnit } = await supabase
          .from('reservations')
          .select('id')
          .eq('amenity_id', amenity.id)
          .eq('unit_id', primary.unit_id)
          .in('status', ['confirmed', 'pending'])
          .gte('ends_at', nowIso);

        if ((activeForUnit?.length ?? 0) >= amenity.max_active_reservations) {
          return {
            ok: false,
            message: `Tu unidad ya tiene ${amenity.max_active_reservations} reserva(s) activa(s) en ${amenity.name}.`,
          };
        }
      }

      if (blockIfOverdue && amenity.restrict_if_overdue) {
        const delinquent = await hasOutstandingDebt();
        if (delinquent) {
          return {
            ok: false,
            message: 'Tienes adeudos pendientes. Regulariza tu cuenta para reservar este espacio.',
          };
        }
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
        .in('status', ['confirmed', 'pending'])
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
        .in('status', ['confirmed', 'pending'])
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString());

      if ((sameMonth?.length ?? 0) >= amenity.max_monthly_reservations) {
        return {
          ok: false,
          message: `Límite mensual: ${amenity.max_monthly_reservations} reserva(s) para ${amenity.name}.`,
        };
      }

      const booked = await fetchBookedSlots(amenity.id, startsAt);
      if (!slotHasCapacity(booked, startsAt, endsAt, amenity.max_concurrent_reservations)) {
        return { ok: false, message: 'Ese horario ya no tiene cupo disponible.' };
      }

      return { ok: true, message: null };
    },
    [
      blockIfOverdue,
      fetchBookedSlots,
      hasOutstandingDebt,
      primary?.unit_id,
      user,
    ],
  );

  const createReservation = useCallback(
    async (amenity: Amenity, startsAt: Date, endsAt: Date) => {
      if (!user || !primary?.condominium_id || !primary.unit_id) {
        return { error: 'Sin unidad asignada.', pending: false };
      }

      setActionError(null);
      const limitCheck = await canBook(amenity, startsAt, endsAt);
      if (!limitCheck.ok) {
        setActionError(limitCheck.message);
        return { error: limitCheck.message, pending: false };
      }

      const booked = await fetchBookedSlots(amenity.id, startsAt);
      if (!slotHasCapacity(booked, startsAt, endsAt, amenity.max_concurrent_reservations)) {
        const message = 'Ese horario ya no tiene cupo disponible.';
        setActionError(message);
        return { error: message, pending: false };
      }

      const { error } = await supabase.rpc('create_reservation_rpc', {
        p_amenity_id: amenity.id,
        p_unit_id: primary.unit_id,
        p_starts_at: startsAt.toISOString(),
        p_ends_at: endsAt.toISOString(),
      });

      if (error) {
        setActionError(error.message);
        return { error: error.message, pending: false };
      }

      const pending = amenity.requires_approval;
      await refresh();
      return { error: null, pending };
    },
    [canBook, fetchBookedSlots, primary, refresh, user],
  );

  const canCancelReservation = useCallback((reservation: Reservation, amenity?: Amenity | null) => {
    const rulesAmenity = amenity ?? null;
    const leadHours = rulesAmenity?.min_cancel_lead_hours ?? 24;
    const startsAt = new Date(reservation.starts_at);
    if (!canCancelByLead(startsAt, leadHours)) {
      return {
        ok: false,
        message: minCancelLeadMessage(leadHours),
      };
    }
    return { ok: true, message: null };
  }, []);

  const cancelReservation = useCallback(
    async (reservationId: string) => {
      setActionError(null);
      const reservation = reservations.find((row) => row.id === reservationId);
      const linkedAmenity = reservation
        ? amenities.find((row) => row.id === reservation.amenity_id)
        : null;
      if (reservation) {
        const cancelCheck = canCancelReservation(reservation, linkedAmenity);
        if (!cancelCheck.ok) {
          setActionError(cancelCheck.message);
          return { error: cancelCheck.message };
        }
      }

      const { error } = await supabase.rpc('cancel_reservation_rpc', {
        p_reservation_id: reservationId,
      });

      if (error) {
        setActionError(error.message);
        return { error: error.message };
      }

      await refresh();
      return { error: null };
    },
    [amenities, canCancelReservation, refresh, reservations],
  );

  const checkUnitDebt = useCallback(async () => {
    if (!primary?.unit_id) return false;
    const { data } = await supabase
      .from('charges')
      .select('due_date, status')
      .eq('unit_id', primary.unit_id)
      .in('status', ['pending', 'overdue']);
    return (data ?? []).some((charge) => isDelinquentCharge(charge));
  }, [primary?.unit_id]);

  const clearActionError = useCallback(() => setActionError(null), []);

  return {
    amenities: visibleAmenities,
    allAmenities: amenities,
    reservations,
    loading,
    refreshing,
    actionError,
    scopeFilter,
    setScopeFilter,
    unitClusterId,
    unitClusterName,
    blockIfOverdue,
    checkUnitDebt,
    clearActionError,
    refresh,
    fetchBookedSlots,
    createReservation,
    cancelReservation,
    canCancelReservation,
    amenityName,
    amenityImageUrl,
  };
}
