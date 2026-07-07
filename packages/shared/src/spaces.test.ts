import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookingDayOptions,
  bookingDayOptionsFiltered,
  canCancelByLead,
  countOverlappingBookings,
  countAvailableSlots,
  formatTodayAvailabilityLabel,
  formatDateKey,
  isBlockedDate,
  isWithinBookingHorizon,
  meetsMinBookingLead,
  normalizeBookingHorizonDays,
  parseBlockedDates,
  parseBlockedDatesInput,
  slotHasCapacity,
} from './spaces';

describe('spaces reservation rules', () => {
  it('normalizes booking horizon within bounds', () => {
    assert.equal(normalizeBookingHorizonDays(0), 1);
    assert.equal(normalizeBookingHorizonDays(30), 30);
    assert.equal(normalizeBookingHorizonDays(999), 90);
  });

  it('parses blocked dates input', () => {
    assert.deepEqual(parseBlockedDatesInput('2026-12-25\n2026-01-01, bad'), [
      '2026-01-01',
      '2026-12-25',
    ]);
    assert.deepEqual(parseBlockedDates(['2026-12-25', 'invalid']), ['2026-12-25']);
  });

  it('builds booking day options', () => {
    const days = bookingDayOptions(3);
    assert.equal(days.length, 3);
    assert.equal(formatDateKey(days[0]), formatDateKey(new Date()));
  });

  it('filters blocked dates from booking options', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blocked = [formatDateKey(today)];
    const days = bookingDayOptionsFiltered(3, blocked);
    assert.equal(days.length, 2);
  });

  it('checks booking horizon inclusively for today', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    assert.equal(isWithinBookingHorizon(today, 7), true);
  });

  it('detects blocked dates', () => {
    const day = new Date('2026-12-25T10:00:00');
    assert.equal(isBlockedDate(day, ['2026-12-25']), true);
    assert.equal(isBlockedDate(day, ['2026-12-24']), false);
  });

  it('enforces minimum booking lead time', () => {
    const now = new Date('2026-07-07T10:00:00');
    const startsAt = new Date('2026-07-07T12:30:00');
    assert.equal(meetsMinBookingLead(startsAt, 2, now), true);
    assert.equal(meetsMinBookingLead(startsAt, 3, now), false);
  });

  it('enforces cancel lead time', () => {
    const now = new Date('2026-07-07T10:00:00');
    const startsAt = new Date('2026-07-08T10:00:00');
    assert.equal(canCancelByLead(startsAt, 24, now), true);
    assert.equal(canCancelByLead(new Date('2026-07-07T20:00:00'), 24, now), false);
  });

  it('counts overlapping bookings and slot capacity', () => {
    const booked = [
      { starts_at: '2026-07-07T18:00:00.000Z', ends_at: '2026-07-07T19:00:00.000Z' },
      { starts_at: '2026-07-07T18:30:00.000Z', ends_at: '2026-07-07T19:30:00.000Z' },
    ];
    const startsAt = new Date('2026-07-07T18:15:00.000Z');
    const endsAt = new Date('2026-07-07T19:15:00.000Z');
    assert.equal(countOverlappingBookings(booked, startsAt, endsAt), 2);
    assert.equal(slotHasCapacity(booked, startsAt, endsAt, 2), false);
    assert.equal(slotHasCapacity(booked, startsAt, endsAt, 3), true);
  });

  it('formats today availability labels', () => {
    assert.equal(formatTodayAvailabilityLabel(0), 'Lleno hoy');
    assert.equal(formatTodayAvailabilityLabel(1), '1 horario hoy');
    assert.equal(formatTodayAvailabilityLabel(3), '3 horarios hoy');
  });

  it('counts available slots', () => {
    const slots = [
      { startsAt: new Date(), endsAt: new Date(), available: true },
      { startsAt: new Date(), endsAt: new Date(), available: false },
      { startsAt: new Date(), endsAt: new Date(), available: true },
    ];
    assert.equal(countAvailableSlots(slots), 2);
  });
});
