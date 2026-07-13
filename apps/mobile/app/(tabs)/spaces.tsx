import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { AmenityCard } from '@/components/AmenityCard';
import { AmenityReservationModal } from '@/components/AmenityReservationModal';
import { ReservationDetailModal } from '@/components/ReservationDetailModal';
import { ReservationsCalendar } from '@/components/ReservationsCalendar';
import { ScreenHeader } from '@/components/ui/Avatar';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScopeFilterBar } from '@/components/ui/ScopeFilterBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { GlassCard } from '@/components/ui/GlassCard';
import { accentColor, surfaceAccentBanner } from '@/constants/surface';
import { useAmenityAvailability } from '@/hooks/useAmenityAvailability';
import { type Amenity, type Reservation, useSpaces } from '@/hooks/useSpaces';
import { useCondominiumClusters } from '@/hooks/useCondominiumClusters';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';
import { reservationAccentTone, reservationTagTone } from '@/lib/card-accent';

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

type SpacesTab = 'spaces' | 'reservations';
type ReservationsView = 'list' | 'calendar';

export default function SpacesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reservationId?: string }>();
  const { primary, loading: membershipLoading } = useMembership();
  const { condominiumName, scopeFilterItems, hasClusters, loading: clustersLoading } =
    useCondominiumClusters(primary);
  const {
    amenities,
    reservations,
    loading,
    refreshing,
    actionError,
    scopeFilter,
    setScopeFilter,
    blockIfOverdue,
    checkUnitDebt,
    clearActionError,
    getReservationById,
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

  const [tab, setTab] = useState<SpacesTab>('spaces');
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [reservationsView, setReservationsView] = useState<ReservationsView>('list');
  const handledReservationParam = useRef<string | null>(null);

  const amenityById = useMemo(
    () => new Map(allAmenities.map((amenity) => [amenity.id, amenity])),
    [allAmenities],
  );

  const openAmenity = useCallback(
    async (amenity: Amenity) => {
      clearActionError();
      setSuccessMessage(null);
      setInfoMessage(null);
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
    if (!reservationId || loading) return;
    if (handledReservationParam.current === reservationId) return;

    void (async () => {
      const fromList = reservations.find((row) => row.id === reservationId) ?? null;
      const found = fromList ?? (await getReservationById(reservationId));
      handledReservationParam.current = reservationId;
      setTab('reservations');

      if (!found) {
        setInfoMessage('Esta reserva ya no está disponible o no pertenece a tu unidad.');
        return;
      }

      if (found.status === 'cancelled') {
        setInfoMessage('Tu reserva fue cancelada o rechazada. Abre el detalle para más información.');
      } else if (found.status === 'confirmed') {
        setSuccessMessage('Tu reserva está confirmada.');
      }

      setSelectedReservation(found);
    })();
  }, [getReservationById, loading, params.reservationId, reservations]);

  if (membershipLoading || clustersLoading || loading) {
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
                setInfoMessage(null);
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
            <View style={[styles.banner, surfaceAccentBanner(theme, 'orange')]}>
              <Text style={[styles.hint, { color: theme.textMuted, marginHorizontal: 0, marginBottom: 0 }]}>
                Algunos espacios pueden bloquearse si tu unidad tiene adeudos.
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={[styles.banner, surfaceAccentBanner(theme, 'green')]}>
              <Text style={[styles.success, { color: accentColor(theme, 'green'), marginHorizontal: 0, marginBottom: 0 }]}>
                {successMessage}
              </Text>
            </View>
          ) : null}
          {infoMessage ? (
            <View style={[styles.banner, surfaceAccentBanner(theme, 'orange')]}>
              <Text style={[styles.success, { color: accentColor(theme, 'orange'), marginHorizontal: 0, marginBottom: 0 }]}>
                {infoMessage}
              </Text>
            </View>
          ) : null}
          {actionError ? (
            <View style={[styles.banner, surfaceAccentBanner(theme, 'danger')]}>
              <Text style={[styles.error, { color: accentColor(theme, 'danger'), marginHorizontal: 0, marginBottom: 0 }]}>
                {actionError}
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <TabStrip
              tabs={[
                { key: 'spaces', label: 'Espacios' },
                { key: 'reservations', label: 'Mis reservas' },
              ]}
              active={tab}
              onChange={(key) => setTab(key as SpacesTab)}
            />

            {hasClusters ? (
              <ScopeFilterBar items={scopeFilterItems} active={scopeFilter} onChange={setScopeFilter} />
            ) : null}

            {tab === 'spaces' ? (
              amenities.length === 0 ? (
                <GlassCard>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin espacios en esta vista</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    {hasClusters
                      ? 'Prueba otro alcance o espera a que administración publique amenidades.'
                      : 'Cuando administración publique amenidades, aparecerán aquí.'}
                  </Text>
                </GlassCard>
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
                      layout="list"
                      name={amenity.name}
                      scopeLabel={amenity.cluster_name ?? condominiumName}
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
              )
            ) : (
              <>
                <View style={styles.reservationsToolbar}>
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

                {reservations.length === 0 ? (
                  <GlassCard>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin reservas próximas</Text>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      Reserva un espacio común desde la pestaña Espacios.
                    </Text>
                    <Pressable onPress={() => setTab('spaces')} style={{ marginTop: 12, alignSelf: 'center' }}>
                      <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>Ver espacios →</Text>
                    </Pressable>
                  </GlassCard>
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
                        <GlassCard
                          style={styles.cardGap}
                          noPadding
                          variant="accent"
                          accent={reservationAccentTone(reservation.status)}
                        >
                          <View style={styles.reservationRow}>
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
                                  tone={reservationTagTone(reservation.status)}
                                />
                              </View>
                              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                                {formatReservationRange(reservation.starts_at, reservation.ends_at)}
                              </Text>
                              <Text style={[styles.viewDetail, { color: theme.accent }]}>Ver detalle</Text>
                            </View>
                          </View>
                        </GlassCard>
                      </Pressable>
                    );
                  })
                )}
              </>
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
          if (!result.error) {
            setInfoMessage(null);
            if (result.pending) {
              setSuccessMessage('Solicitud enviada. La administración debe aprobar tu reserva.');
            } else {
              setSuccessMessage('Reserva confirmada. Ya puedes verla en Mis reservas.');
              setTab('reservations');
            }
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
                setTab('spaces');
                void openAmenity(amenity);
              }
            : undefined
        }
        onCancel={async (reservationId) => {
          setCancellingId(reservationId);
          const result = await cancelReservation(reservationId);
          setCancellingId(null);
          if (!result.error) {
            setInfoMessage(null);
            setSuccessMessage('Reserva cancelada.');
          }
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
  hint: { fontSize: 12 },
  banner: { marginHorizontal: 20, marginBottom: 8 },
  success: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 14, fontWeight: '600' },
  reservationsToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
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
  cardGap: { marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
