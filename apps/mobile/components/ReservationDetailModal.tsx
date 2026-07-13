import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { amenityScopeLabel, resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Tag } from '@/components/ui/Tag';
import type { Reservation } from '@/hooks/useSpaces';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface ReservationDetailModalProps {
  visible: boolean;
  reservation: Reservation | null;
  amenityLabel: string;
  amenityImagePath: string | null;
  amenityClusterId?: string | null;
  amenityClusterName?: string | null;
  cancelling: boolean;
  canCancel: boolean;
  cancelBlockedMessage?: string | null;
  onClose: () => void;
  onCancel: (reservationId: string) => Promise<void>;
  onRebook?: () => void;
  formatRange: (startsAt: string, endsAt: string) => string;
  fallbackEmoji: string;
}

function reservationTone(status: Reservation['status']): 'green' | 'orange' | 'gray' | 'red' {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  if (status === 'cancelled') return 'red';
  return 'gray';
}

function statusLabel(status: Reservation['status']): string {
  if (status === 'pending') return 'Pendiente de aprobación';
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'completed') return 'Completada';
  return status;
}

export function ReservationDetailModal({
  visible,
  reservation,
  amenityLabel,
  amenityImagePath,
  amenityClusterId,
  amenityClusterName,
  cancelling,
  canCancel,
  cancelBlockedMessage,
  onClose,
  onCancel,
  onRebook,
  formatRange,
  fallbackEmoji,
}: ReservationDetailModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!reservation) return null;

  const imageUri = resolveStorageImageUrl(
    SUPABASE_URL,
    amenityImagePath,
    STORAGE_BUCKETS.AMENITY_IMAGES,
  );

  const handleCancel = () => {
    Alert.alert(
      'Cancelar reserva',
      `¿Seguro que deseas cancelar tu reserva de ${amenityLabel}? Esta acción no se puede deshacer.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            void onCancel(reservation.id).then(() => onClose());
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Detalle de reserva</Text>
          <Pressable onPress={onClose}>
            <Text style={[styles.close, { color: colors.primary }]}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.emojiWrap, { backgroundColor: colors.card }]}>
              <Text style={styles.emoji}>{fallbackEmoji}</Text>
            </View>
          )}

          <View style={styles.titleRow}>
            <Text style={[styles.amenityName, { color: colors.text }]}>{amenityLabel}</Text>
            <Tag label={statusLabel(reservation.status)} tone={reservationTone(reservation.status)} />
          </View>

          <Text style={[styles.meta, { color: colors.muted }]}>
            {amenityScopeLabel(amenityClusterId, amenityClusterName)}
          </Text>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>Fecha y horario</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatRange(reservation.starts_at, reservation.ends_at)}
            </Text>
          </View>

          {reservation.status === 'pending' ? (
            <Text style={[styles.note, { color: colors.muted }]}>
              La administración debe aprobar esta solicitud antes de que quede confirmada.
            </Text>
          ) : null}

          {reservation.status === 'cancelled' ? (
            <>
              <Text style={[styles.note, { color: colors.muted }]}>
                Esta reserva ya no está activa. Puedes volver a reservar el espacio si aún está disponible.
              </Text>
              {onRebook ? (
                <PrimaryButton label="Reservar de nuevo" onPress={onRebook} style={{ marginTop: 20 }} />
              ) : null}
            </>
          ) : null}

          {reservation.status === 'confirmed' || reservation.status === 'pending' ? (
            <>
              {onRebook ? (
                <PrimaryButton
                  label="Reservar de nuevo"
                  onPress={onRebook}
                  style={{ marginTop: 20 }}
                />
              ) : null}
              {!canCancel && cancelBlockedMessage ? (
                <Text style={[styles.note, { color: colors.muted }]}>{cancelBlockedMessage}</Text>
              ) : null}
              <PrimaryButton
                label={cancelling ? 'Cancelando…' : 'Cancelar reserva'}
                variant="muted"
                disabled={cancelling || !canCancel}
                onPress={handleCancel}
                style={{ marginTop: onRebook ? 12 : 20 }}
              />
            </>
          ) : null}
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
  heroImage: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16 },
  emojiWrap: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: { fontSize: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  amenityName: { fontSize: 20, fontWeight: '700', flex: 1 },
  meta: { fontSize: 13, marginBottom: 16 },
  infoCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  infoLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  infoValue: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 13, lineHeight: 20, marginTop: 14 },
});
