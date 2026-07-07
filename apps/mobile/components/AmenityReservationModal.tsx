import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { bookingDayOptionsFiltered, resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  buildSlotsForDay,
  type Amenity,
  type TimeSlot,
} from '@/hooks/useSpaces';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface AmenityReservationModalProps {
  visible: boolean;
  amenity: Amenity | null;
  bookingHorizonDays: number;
  blockedDates: string[];
  minBookingLeadHours: number;
  onClose: () => void;
  onReserve: (startsAt: Date, endsAt: Date) => Promise<{ error: string | null; pending?: boolean }>;
  fetchBookedSlots: (amenityId: string, day: Date) => Promise<{ starts_at: string; ends_at: string }[]>;
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Hoy';
  if (date.getTime() === tomorrow.getTime()) return 'Mañana';
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    date,
  );
}

export function AmenityReservationModal({
  visible,
  amenity,
  bookingHorizonDays,
  blockedDates,
  minBookingLeadHours,
  onClose,
  onReserve,
  fetchBookedSlots,
}: AmenityReservationModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const days = useMemo(
    () => bookingDayOptionsFiltered(bookingHorizonDays, blockedDates),
    [bookingHorizonDays, blockedDates],
  );
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    if (!amenity) return;
    setLoadingSlots(true);
    const booked = await fetchBookedSlots(amenity.id, selectedDay);
    setSlots(buildSlotsForDay(amenity, selectedDay, booked, minBookingLeadHours));
    setLoadingSlots(false);
  }, [amenity, fetchBookedSlots, minBookingLeadHours, selectedDay]);

  useEffect(() => {
    if (visible && amenity && days.length > 0) {
      setSelectedDay(days[0]);
      setLocalError(null);
    }
  }, [visible, amenity, days]);

  useEffect(() => {
    if (visible && amenity) {
      void loadSlots();
    }
  }, [visible, amenity, selectedDay, loadSlots]);

  const handleReserve = async (slot: TimeSlot) => {
    if (!amenity || !slot.available) return;
    setSubmitting(true);
    setLocalError(null);
    const result = await onReserve(slot.startsAt, slot.endsAt);
    setSubmitting(false);
    if (result.error) {
      setLocalError(result.error);
      await loadSlots();
      return;
    }
    onClose();
  };

  if (!amenity) return null;

  const imageUri = resolveStorageImageUrl(
    SUPABASE_URL,
    amenity.image_url,
    STORAGE_BUCKETS.AMENITY_IMAGES,
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Reservar {amenity.name}</Text>
          <Pressable onPress={onClose}>
            <Text style={[styles.close, { color: colors.primary }]}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : null}
          {amenity.description ? (
            <Text style={[styles.description, { color: colors.muted }]}>{amenity.description}</Text>
          ) : null}

          <Text style={[styles.label, { color: colors.muted }]}>Día</Text>
          <Text style={[styles.hint, { color: colors.muted, marginTop: 0, marginBottom: 10 }]}>
            Puedes reservar hasta {bookingHorizonDays} día(s) por adelantado
            {minBookingLeadHours > 0 ? ` · mínimo ${minBookingLeadHours} h antes del horario` : ''}.
          </Text>
          {days.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              No hay fechas disponibles en el horizonte configurado.
            </Text>
          ) : (
            <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((day) => {
              const active = day.getTime() === selectedDay.getTime();
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => setSelectedDay(day)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                    {formatDayLabel(day)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { color: colors.muted, marginTop: 20 }]}>Horario disponible</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Bloques de {amenity.slot_duration_minutes} min · cupo {amenity.max_concurrent_reservations} por horario ·
            máx. {amenity.max_daily_reservations}/día · {amenity.max_monthly_reservations}/mes
            {amenity.requires_approval ? ' · requiere aprobación' : ''}
          </Text>

          {loadingSlots ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : slots.filter((slot) => slot.available).length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>No hay horarios disponibles este día.</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((slot) => (
                <Pressable
                  key={slot.startsAt.toISOString()}
                  disabled={!slot.available || submitting}
                  onPress={() => void handleReserve(slot)}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: slot.available ? colors.card : colors.border,
                      borderColor: colors.border,
                      opacity: slot.available ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
            </>
          )}

          {localError ? <Text style={[styles.error, { color: colors.danger }]}>{localError}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  close: { fontSize: 15, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  heroImage: { width: '100%', height: 140, borderRadius: 14, marginBottom: 12 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  dayRow: { gap: 8, marginTop: 10 },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  slotChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: '30%',
    alignItems: 'center',
  },
  empty: { marginTop: 16, fontSize: 14 },
  error: { marginTop: 16, fontSize: 14 },
});
