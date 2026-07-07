import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateKey } from '@veka/shared';

import { useTheme } from '@/hooks/useTheme';
import type { Reservation } from '@/hooks/useSpaces';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface ReservationsCalendarProps {
  reservations: Reservation[];
  onSelectReservation: (reservation: Reservation) => void;
  amenityName: (reservation: Reservation) => string;
  formatRange: (startsAt: string, endsAt: string) => string;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(date);
}

export function ReservationsCalendar({
  reservations,
  onSelectReservation,
  amenityName,
  formatRange,
}: ReservationsCalendarProps) {
  const theme = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(formatDateKey(new Date()));

  const reservationDays = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of reservations) {
      const key = formatDateKey(new Date(reservation.starts_at));
      const list = map.get(key) ?? [];
      list.push(reservation);
      map.set(key, list);
    }
    return map;
  }, [reservations]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const grid: (Date | null)[] = [];

    for (let i = 0; i < mondayOffset; i++) grid.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(new Date(year, monthIndex, day));
    }
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [month]);

  const selectedReservations = selectedDayKey ? (reservationDays.get(selectedDayKey) ?? []) : [];
  const todayKey = formatDateKey(new Date());

  return (
    <View>
      <View style={styles.monthHeader}>
        <Pressable onPress={() => setMonth((current) => addMonths(current, -1))} hitSlop={12}>
          <Text style={[styles.nav, { color: theme.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: theme.text, fontFamily: theme.sansFamily }]}>
          {monthTitle(month)}
        </Text>
        <Pressable onPress={() => setMonth((current) => addMonths(current, 1))} hitSlop={12}>
          <Text style={[styles.nav, { color: theme.accent }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={[styles.weekday, { color: theme.textSubtle }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }

          const key = formatDateKey(day);
          const hasReservation = reservationDays.has(key);
          const isSelected = selectedDayKey === key;
          const isToday = key === todayKey;

          return (
            <Pressable
              key={key}
              onPress={() => setSelectedDayKey(key)}
              style={[
                styles.cell,
                isSelected ? { backgroundColor: `${theme.accent}18`, borderRadius: 10 } : null,
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: isSelected || isToday ? theme.accent : theme.text,
                    fontWeight: isToday ? '700' : '500',
                  },
                ]}
              >
                {day.getDate()}
              </Text>
              {hasReservation ? (
                <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.dayList, { borderTopColor: theme.border }]}>
        {selectedDayKey ? (
          selectedReservations.length > 0 ? (
            selectedReservations.map((reservation) => (
              <Pressable
                key={reservation.id}
                onPress={() => onSelectReservation(reservation)}
                style={[styles.dayItem, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.dayItemTitle, { color: theme.text }]}>{amenityName(reservation)}</Text>
                <Text style={[styles.dayItemMeta, { color: theme.textMuted }]}>
                  {formatRange(reservation.starts_at, reservation.ends_at)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyDay, { color: theme.textMuted }]}>Sin reservas este día.</Text>
          )
        ) : (
          <Text style={[styles.emptyDay, { color: theme.textMuted }]}>Selecciona un día del calendario.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nav: { fontSize: 28, fontWeight: '300', width: 32, textAlign: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayNumber: { fontSize: 14 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 3,
  },
  dotPlaceholder: { height: 8 },
  dayList: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dayItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  dayItemTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  dayItemMeta: { fontSize: 12 },
  emptyDay: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});
