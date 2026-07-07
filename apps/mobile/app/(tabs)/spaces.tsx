import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { AmenityReservationModal } from '@/components/AmenityReservationModal';
import { ReservationDetailModal } from '@/components/ReservationDetailModal';
import { ScreenHeader, SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Tag } from '@/components/ui/Tag';
import { type Amenity, type Reservation, useSpaces } from '@/hooks/useSpaces';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

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

function reservationTone(status: Reservation['status']): 'green' | 'orange' | 'gray' {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  return 'gray';
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
    scopeFilter,
    setScopeFilter,
    unitClusterName,
    blockIfOverdue,
    bookingHorizonDays,
    clearActionError,
    refresh,
    fetchBookedSlots,
    createReservation,
    cancelReservation,
    amenityName,
    amenityImageUrl,
    allAmenities,
  } = useSpaces(primary);

  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const amenityById = useMemo(
    () => new Map(allAmenities.map((amenity) => [amenity.id, amenity])),
    [allAmenities],
  );

  const scopeOptions = useMemo(() => {
    const options: { id: 'all' | 'general' | 'cluster'; label: string }[] = [
      { id: 'all', label: 'Todos' },
      { id: 'general', label: 'Fraccionamiento' },
    ];
    if (primary?.unit?.cluster?.id) {
      options.push({ id: 'cluster', label: unitClusterName ?? 'Mi torre' });
    }
    return options;
  }, [primary?.unit?.cluster?.id, unitClusterName]);

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
                setSuccessMessage(null);
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

          {blockIfOverdue ? (
            <Text style={[styles.hint, { color: theme.textSubtle }]}>
              Algunos espacios pueden bloquearse si tu unidad tiene adeudos.
            </Text>
          ) : null}

          {successMessage ? <Text style={[styles.success, { color: theme.success }]}>{successMessage}</Text> : null}
          {actionError ? <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow}>
            {scopeOptions.map((option) => {
              const active = scopeFilter === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setScopeFilter(option.id)}
                  style={[
                    styles.scopeChip,
                    {
                      backgroundColor: active ? theme.accent : 'transparent',
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.onAccent : theme.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <SectionLabel title="Amenidades" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tilesRow}>
            {amenities.length === 0 ? (
              <GlassCard style={styles.tile}>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>No hay espacios en esta vista.</Text>
              </GlassCard>
            ) : (
              amenities.map((amenity) => {
                const imageUri = resolveStorageImageUrl(
                  SUPABASE_URL,
                  amenity.image_url,
                  STORAGE_BUCKETS.AMENITY_IMAGES,
                );

                return (
                  <GlassCard key={amenity.id} style={styles.tile}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.tileImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.tileEmoji}>{amenityEmoji(amenity.name)}</Text>
                    )}
                    <Text style={[styles.tileTitle, { color: theme.text }]}>{amenity.name}</Text>
                    <Text style={[styles.tileMeta, { color: theme.textSubtle }]}>
                      {amenity.cluster_name ?? 'Fraccionamiento'} · {amenity.open_time.slice(0, 5)}–
                      {amenity.close_time.slice(0, 5)}
                    </Text>
                    {amenity.requires_approval ? (
                      <Tag label="Requiere aprobación" tone="orange" />
                    ) : null}
                    <PrimaryButton
                      label="Reservar"
                      onPress={() => {
                        clearActionError();
                        setSuccessMessage(null);
                        setSelectedAmenity(amenity);
                      }}
                      style={styles.reserveBtn}
                    />
                  </GlassCard>
                );
              })
            )}
          </ScrollView>

          <SectionLabel title="Mis reservas" />
          <View style={styles.section}>
            {reservations.length === 0 ? (
              <GlassCard>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No tienes reservas próximas.</Text>
              </GlassCard>
            ) : (
              reservations.map((reservation) => {
                const imageUri = resolveStorageImageUrl(
                  SUPABASE_URL,
                  amenityImageUrl(reservation),
                  STORAGE_BUCKETS.AMENITY_IMAGES,
                );
                const name = amenityName(reservation);

                return (
                  <Pressable key={reservation.id} onPress={() => setSelectedReservation(reservation)}>
                    <GlassCard style={styles.cardGap} noPadding>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.reservationImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.reservationEmojiWrap, { backgroundColor: theme.surface }]}>
                          <Text style={styles.reservationEmoji}>{amenityEmoji(name)}</Text>
                        </View>
                      )}
                      <View style={styles.reservationBody}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{name}</Text>
                          <Tag
                            label={reservation.status === 'pending' ? 'Pendiente' : 'Confirmada'}
                            tone={reservationTone(reservation.status)}
                          />
                        </View>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          {formatReservationRange(reservation.starts_at, reservation.ends_at)}
                        </Text>
                        <Text style={[styles.viewDetail, { color: theme.accent }]}>Ver detalle</Text>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </ScreenBackground>

      <AmenityReservationModal
        visible={selectedAmenity !== null}
        amenity={selectedAmenity}
        bookingHorizonDays={bookingHorizonDays}
        onClose={() => setSelectedAmenity(null)}
        onReserve={async (startsAt, endsAt) => {
          if (!selectedAmenity) return { error: null, pending: false };
          const result = await createReservation(selectedAmenity, startsAt, endsAt);
          if (!result.error && result.pending) {
            setSuccessMessage('Solicitud enviada. La administración debe aprobar tu reserva.');
          }
          return result;
        }}
        fetchBookedSlots={fetchBookedSlots}
      />

      <ReservationDetailModal
        visible={selectedReservation !== null}
        reservation={selectedReservation}
        amenityLabel={selectedReservation ? amenityName(selectedReservation) : ''}
        amenityImagePath={selectedReservation ? amenityImageUrl(selectedReservation) : null}
        amenityClusterId={selectedReservation ? amenityById.get(selectedReservation.amenity_id)?.cluster_id : null}
        amenityClusterName={
          selectedReservation ? amenityById.get(selectedReservation.amenity_id)?.cluster_name : null
        }
        cancelling={selectedReservation ? cancellingId === selectedReservation.id : false}
        onClose={() => setSelectedReservation(null)}
        onCancel={async (reservationId) => {
          setCancellingId(reservationId);
          await cancelReservation(reservationId);
          setCancellingId(null);
        }}
        formatRange={formatReservationRange}
        fallbackEmoji={
          selectedReservation ? amenityEmoji(amenityName(selectedReservation)) : '🏢'
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  hint: { fontSize: 12, marginHorizontal: 20, marginBottom: 8 },
  success: { fontSize: 14, marginHorizontal: 20, marginBottom: 8 },
  error: { fontSize: 14, marginHorizontal: 20, marginBottom: 8 },
  scopeRow: { gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  scopeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tilesRow: { gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  tile: { width: 156, minHeight: 210 },
  tileImage: { width: '100%', height: 72, borderRadius: 12, marginBottom: 8 },
  tileEmoji: { fontSize: 28, marginBottom: 8 },
  tileTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tileMeta: { fontSize: 11, marginBottom: 8 },
  reserveBtn: { marginTop: 8, paddingVertical: 10, minHeight: 40 },
  cardGap: { marginBottom: 12, overflow: 'hidden' },
  reservationImage: { width: '100%', height: 120 },
  reservationEmojiWrap: {
    width: '100%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservationEmoji: { fontSize: 32 },
  reservationBody: { padding: 16 },
  viewDetail: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
