import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmenityReservationModal } from '@/components/AmenityReservationModal';
import { ScreenHeader, SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Tag } from '@/components/ui/Tag';
import { type Amenity, useSpaces } from '@/hooks/useSpaces';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';

function formatReservationRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(start);
  const time = `${new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(start)} – ${new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(end)}`;
  return `${date} · ${time}`;
}

const AMENITY_EMOJI: Record<string, string> = {
  alberca: '🏊',
  gimnasio: '🏋️',
  salón: '🎉',
  salon: '🎉',
};

function amenityEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(AMENITY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '🏢';
}

export default function SpacesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const {
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
  } = useSpaces(primary);

  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (membershipLoading || loading) {
    return (
      <ScreenBackground style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ScreenBackground>
    );
  }

  if (!primary?.unit_id) {
    return (
      <ScreenBackground style={[styles.centered, { padding: 24 }]}>
        <GlassCard>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin unidad asignada</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Pide a la administración que te invite con tu correo electrónico.
          </Text>
        </GlassCard>
      </ScreenBackground>
    );
  }

  return (
    <>
      <ScreenBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                clearActionError();
                void refresh();
              }}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="Espacios"
            highlight="comunes"
            subtitle={`${primary.condominium?.name} · Unidad ${primary.unit?.identifier}`}
          />

          {actionError ? <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text> : null}

          <SectionLabel title="Amenidades" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tilesRow}>
            {amenities.length === 0 ? (
              <GlassCard style={styles.tile}>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>No hay espacios configurados.</Text>
              </GlassCard>
            ) : (
              amenities.map((amenity) => (
                <GlassCard key={amenity.id} style={styles.tile}>
                    <Text style={styles.tileEmoji}>{amenityEmoji(amenity.name)}</Text>
                    <Text style={[styles.tileTitle, { color: theme.text }]}>{amenity.name}</Text>
                    <Text style={[styles.tileMeta, { color: theme.textSubtle }]}>
                      {amenity.open_time.slice(0, 5)}–{amenity.close_time.slice(0, 5)}
                    </Text>
                    <PrimaryButton
                      label="Reservar"
                      onPress={() => {
                        clearActionError();
                        setSelectedAmenity(amenity);
                      }}
                      style={styles.reserveBtn}
                    />
                </GlassCard>
              ))
            )}
          </ScrollView>

          <SectionLabel title="Mis reservas" />
          <View style={styles.section}>
            {reservations.length === 0 ? (
              <GlassCard>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No tienes reservas próximas.</Text>
              </GlassCard>
            ) : (
              reservations.map((reservation) => (
                <GlassCard key={reservation.id} style={styles.cardGap}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{amenityName(reservation)}</Text>
                    <Tag label="Confirmada" tone="green" />
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                    {formatReservationRange(reservation.starts_at, reservation.ends_at)}
                  </Text>
                  <PrimaryButton
                    label={cancellingId === reservation.id ? 'Cancelando…' : 'Cancelar reserva'}
                    variant="secondary"
                    disabled={cancellingId === reservation.id}
                    onPress={async () => {
                      setCancellingId(reservation.id);
                      await cancelReservation(reservation.id);
                      setCancellingId(null);
                    }}
                    style={{ marginTop: 12 }}
                  />
                </GlassCard>
              ))
            )}
          </View>
        </ScrollView>
      </ScreenBackground>

      <AmenityReservationModal
        visible={selectedAmenity !== null}
        amenity={selectedAmenity}
        onClose={() => setSelectedAmenity(null)}
        onReserve={(startsAt, endsAt) =>
          selectedAmenity ? createReservation(selectedAmenity, startsAt, endsAt) : Promise.resolve({ error: null })
        }
        fetchBookedSlots={fetchBookedSlots}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  error: { fontSize: 14, marginHorizontal: 20, marginBottom: 8 },
  tilesRow: { gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  tile: { width: 140, minHeight: 150 },
  tileEmoji: { fontSize: 28, marginBottom: 8 },
  tileTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tileMeta: { fontSize: 11, marginBottom: 10 },
  reserveBtn: { marginTop: 4, paddingVertical: 10, minHeight: 40 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
