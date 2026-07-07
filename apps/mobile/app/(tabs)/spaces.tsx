import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { AMENITY_CARD_WIDTH, AmenityCard } from '@/components/AmenityCard';
import { AmenityReservationModal } from '@/components/AmenityReservationModal';
import { ReservationDetailModal } from '@/components/ReservationDetailModal';
import { ReservationsCalendar } from '@/components/ReservationsCalendar';
import { ScreenHeader, SectionLabel } from '@/components/ui/Avatar';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Tag } from '@/components/ui/Tag';
import { useAmenityAvailability } from '@/hooks/useAmenityAvailability';
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

type ReservationsView = 'list' | 'calendar';

export default function SpacesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reservationId?: string }>();
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
    checkUnitDebt,
    clearActionError,
    refresh,
    fetchBookedSlots,
    createReservation,
    cancelReservation,
    canCancelReservation,
    amenityName,
    amenityImageUrl,
    allAmenities,
  } = useSpaces(primary);

  const { availabilityLabels, availabilityLoading } = useAmenityAvailability(amenities, fetchBookedSlots);

  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reservationsView, setReservationsView] = useState<ReservationsView>('list');

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

  const openAmenity = useCallback(
    async (amenity: Amenity) => {
      clearActionError();
      setSuccessMessage(null);
      if (blockIfOverdue && amenity.restrict_if_overdue) {
        const delinquent = await checkUnitDebt();
        if (delinquent) {
          Alert.alert(
            'Adeudos pendientes',
            'Tu unidad tiene adeudos pendientes. Regulariza tu cuenta en Finanzas para reservar este espacio.',
            [{ text: 'Entendido' }],
          );
          return;
        }
      }
      setSelectedAmenity(amenity);
    },
    [blockIfOverdue, checkUnitDebt, clearActionError],
  );

  useEffect(() => {
    const reservationId = params.reservationId;
    if (!reservationId || reservations.length === 0) return;
    const found = reservations.find((row) => row.id === reservationId);
    if (found) setSelectedReservation(found);
  }, [params.reservationId, reservations]);

  if (membershipLoading || loading) {
    return (
      <ScreenBackground variant="plain" style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ScreenBackground>
    );
  }

  if (!primary?.unit_id) {
    return (
      <ScreenBackground variant="plain" style={[styles.centered, { padding: 24 }]}>
        <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin unidad asignada</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Pide a la administración que te invite con tu correo electrónico.
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <>
      <ScreenBackground variant="plain">
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
                      backgroundColor: active ? theme.accent : theme.surfaceMuted,
                      borderColor: active ? theme.accent : 'transparent',
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={AMENITY_CARD_WIDTH + 12}
            contentContainerStyle={styles.tilesRow}
          >
            {amenities.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>No hay espacios en esta vista.</Text>
              </View>
            ) : (
              amenities.map((amenity) => {
                const imageUri = resolveStorageImageUrl(
                  SUPABASE_URL,
                  amenity.image_url,
                  STORAGE_BUCKETS.AMENITY_IMAGES,
                );

                return (
                  <AmenityCard
                    key={amenity.id}
                    name={amenity.name}
                    scopeLabel={amenity.cluster_name ?? 'Fraccionamiento'}
                    hoursLabel={`${amenity.open_time.slice(0, 5)}–${amenity.close_time.slice(0, 5)}`}
                    imageUri={imageUri}
                    fallbackEmoji={amenityEmoji(amenity.name)}
                    availabilityLabel={availabilityLabels[amenity.id]}
                    availabilityLoading={availabilityLoading && !availabilityLabels[amenity.id]}
                    requiresApproval={amenity.requires_approval}
                    onPress={() => {
                      void openAmenity(amenity);
                    }}
                  />
                );
              })
            )}
          </ScrollView>

          <View style={styles.reservationsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textSubtle }]}>Mis reservas</Text>
            <View style={[styles.viewToggle, { backgroundColor: theme.surfaceMuted }]}>
              <Pressable
                onPress={() => setReservationsView('list')}
                style={[
                  styles.viewToggleBtn,
                  reservationsView === 'list' ? { backgroundColor: theme.surface } : null,
                ]}
              >
                <Text
                  style={{
                    color: reservationsView === 'list' ? theme.text : theme.textMuted,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  Lista
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setReservationsView('calendar')}
                style={[
                  styles.viewToggleBtn,
                  reservationsView === 'calendar' ? { backgroundColor: theme.surface } : null,
                ]}
              >
                <Text
                  style={{
                    color: reservationsView === 'calendar' ? theme.text : theme.textMuted,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  Calendario
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            {reservations.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No tienes reservas próximas.</Text>
              </View>
            ) : reservationsView === 'calendar' ? (
              <ReservationsCalendar
                reservations={reservations}
                onSelectReservation={setSelectedReservation}
                amenityName={amenityName}
                formatRange={formatReservationRange}
              />
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
                    <View
                      style={[
                        styles.reservationRow,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          shadowColor: theme.shadow,
                        },
                      ]}
                    >
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.reservationThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.reservationThumbFallback, { backgroundColor: theme.surfaceMuted }]}>
                          <Text style={styles.reservationEmoji}>{amenityEmoji(name)}</Text>
                        </View>
                      )}
                      <View style={styles.reservationContent}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                            {name}
                          </Text>
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
                    </View>
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
        blockIfOverdue={blockIfOverdue}
        checkUnitDebt={checkUnitDebt}
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
        canCancel={
          selectedReservation
            ? canCancelReservation(
                selectedReservation,
                amenityById.get(selectedReservation.amenity_id),
              ).ok
            : false
        }
        cancelBlockedMessage={
          selectedReservation
            ? canCancelReservation(
                selectedReservation,
                amenityById.get(selectedReservation.amenity_id),
              ).message
            : null
        }
        onClose={() => setSelectedReservation(null)}
        onRebook={
          selectedReservation
            ? () => {
                const amenity = amenityById.get(selectedReservation.amenity_id);
                if (!amenity) return;
                setSelectedReservation(null);
                void openAmenity(amenity);
              }
            : undefined
        }
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tilesRow: { gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  reservationsHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reservationRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'web' ? 0.04 : 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  reservationThumb: { width: 88, height: 88 },
  reservationThumbFallback: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservationEmoji: { fontSize: 28 },
  reservationContent: { flex: 1, padding: 12, justifyContent: 'center' },
  viewDetail: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    minWidth: 200,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
