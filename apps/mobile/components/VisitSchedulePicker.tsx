import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  compareDateKeys,
  endDateKeyFromStartAndStayDays,
  formatDateKey,
  formatVisitDateRangeLabel,
  isDateKeyBeforeToday,
  normalizeStayDays,
  todayDateKey,
} from '@veka/shared';

import { useTheme } from '@/hooks/useTheme';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface VisitSchedulePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  /** When set, end date is derived from start + stay days (rentas). */
  stayDays?: number;
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

function isInRange(dateKey: string, start: string, end: string): boolean {
  return compareDateKeys(dateKey, start) >= 0 && compareDateKeys(dateKey, end) <= 0;
}

export function VisitSchedulePicker({ startDate, endDate, onChange, stayDays }: VisitSchedulePickerProps) {
  const theme = useTheme();
  const rentalLocked = stayDays != null;
  const [month, setMonth] = useState(() => startOfMonth(parseVisitMonth(startDate)));
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  const effectiveEnd = rentalLocked
    ? endDateKeyFromStartAndStayDays(startDate, normalizeStayDays(stayDays))
    : endDate;

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

  const todayKey = todayDateKey();

  function handleDayPress(dateKey: string) {
    if (isDateKeyBeforeToday(dateKey)) return;

    if (rentalLocked) {
      onChange(dateKey, endDateKeyFromStartAndStayDays(dateKey, normalizeStayDays(stayDays)));
      setRangeAnchor(null);
      return;
    }

    if (!rangeAnchor || compareDateKeys(dateKey, rangeAnchor) < 0) {
      setRangeAnchor(dateKey);
      onChange(dateKey, dateKey);
      return;
    }

    onChange(rangeAnchor, dateKey);
    setRangeAnchor(null);
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textSubtle }]}>Fechas de la visita</Text>
      <Text style={[styles.selection, { color: theme.text }]}>
        {formatVisitDateRangeLabel(startDate, effectiveEnd)}
        {rentalLocked ? ` · ${normalizeStayDays(stayDays)} día(s)` : ''}
      </Text>
      {!rentalLocked ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Toca el primer día y luego el último para un rango de varios días.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Elige el día de inicio; la estancia se calcula con los días indicados abajo.
        </Text>
      )}

      <View style={styles.monthHeader}>
        <Pressable onPress={() => setMonth((current) => addMonths(current, -1))} hitSlop={12}>
          <Text style={[styles.nav, { color: theme.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: theme.text }]}>{monthTitle(month)}</Text>
        <Pressable onPress={() => setMonth((current) => addMonths(current, 1))} hitSlop={12}>
          <Text style={[styles.nav, { color: theme.accent }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={[styles.weekday, { color: theme.textSubtle }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }
          const dateKey = formatDateKey(date);
          const disabled = isDateKeyBeforeToday(dateKey);
          const selected = dateKey === startDate || dateKey === effectiveEnd;
          const inRange = isInRange(dateKey, startDate, effectiveEnd);
          const isToday = dateKey === todayKey;

          return (
            <Pressable
              key={dateKey}
              disabled={disabled}
              onPress={() => handleDayPress(dateKey)}
              style={[
                styles.cell,
                inRange && { backgroundColor: `${theme.accent}18` },
                selected && { backgroundColor: `${theme.accent}33`, borderColor: theme.accent, borderWidth: 1 },
                disabled && styles.cellDisabled,
              ]}
            >
              <Text
                style={{
                  color: disabled ? theme.textSubtle : selected ? theme.accent : theme.text,
                  fontWeight: selected || isToday ? '700' : '500',
                  fontSize: 13,
                }}
              >
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function parseVisitMonth(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  selection: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nav: { fontSize: 24, fontWeight: '600', paddingHorizontal: 8 },
  monthTitle: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellDisabled: { opacity: 0.35 },
});
