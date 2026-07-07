import { router } from 'expo-router';
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
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SectionLabel } from '@/components/ui/Avatar';
import { StatPill } from '@/components/ui/StatPill';
import { Tag } from '@/components/ui/Tag';
import { useDashboard } from '@/hooks/useDashboard';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { mapChargeTone } from '@/lib/tagTone';
import { useAuth } from '@/providers/AuthProvider';

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { primary, loading: membershipLoading } = useMembership();
  const { profile } = useProfile();
  const {
    data,
    loading: dashboardLoading,
    refreshing,
    refresh,
    formatShortDate,
    formatDateTime,
    chargeStatusLabel,
    chargeStatusTone,
    chargeDisplayTitle,
    chargeDisplaySubtitle,
    formatCurrency,
  } = useDashboard(primary);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Residente';

  const avatarUri = resolveStorageImageUrl(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    profile?.avatar_url,
    STORAGE_BUCKETS.AVATARS,
  );

  const loading = membershipLoading || dashboardLoading;
  const firstName = displayName.split(' ')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push('/account')}
          style={styles.headerRow}
          accessibilityRole="button"
          accessibilityLabel="Abrir mi cuenta"
        >
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: theme.textSubtle, fontFamily: theme.sansFamily }]}>
              Hola, {firstName}
            </Text>
            <Text style={[styles.title, { color: theme.text, fontFamily: theme.serifFamily }]}>
              {primary?.condominium?.name ?? 'Veka'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSubtle }]}>
              {primary?.unit
                ? `Unidad ${primary.unit.identifier}`
                : 'Esperando asignación de unidad'}
            </Text>
          </View>
          <Avatar initials={initials} color={theme.accent} size={48} imageUri={avatarUri} />
        </Pressable>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <>
            {primary?.unit_id ? (
              <View style={styles.statsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.statsScroll}
                contentContainerStyle={styles.statsRow}
              >
                <StatPill
                  label="Próximo pago"
                  value={data.nextCharge ? formatCurrency(data.nextCharge.amount) : '—'}
                  sub={data.nextCharge ? formatShortDate(data.nextCharge.due_date) : 'Al día'}
                  valueColor={data.nextCharge?.status === 'overdue' ? theme.danger : theme.accent}
                />
                <StatPill
                  label="Reservas"
                  value={data.upcomingReservation ? '1' : '0'}
                  sub={data.upcomingReservation ? 'activa' : 'sin reservas'}
                  valueColor={theme.accent2}
                />
                <StatPill
                  label="Paquetes"
                  value={data.pendingPackage ? '1' : '0'}
                  sub={data.pendingPackage ? 'en caseta' : 'ninguno'}
                  valueColor={data.pendingPackage ? theme.accent3 : theme.textMuted}
                />
              </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              {!primary?.unit_id ? (
                <GlassCard variant="accent" accent="orange">
                  <Tag label="Pendiente" tone="orange" />
                  <Text style={[styles.cardTitle, { color: theme.text, marginTop: 10 }]}>Sin unidad asignada</Text>
                  <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                    Pide a administración que te invite con el mismo correo con el que te registraste. Al iniciar sesión,
                    tu acceso se activará automáticamente.
                  </Text>
                </GlassCard>
              ) : (
                <>
                  {data.nextCharge ? (
                    <GlassCard
                      style={styles.cardGap}
                      variant="accent"
                      accent={data.nextCharge.status === 'overdue' ? 'danger' : 'blue'}
                    >
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                          {chargeDisplayTitle(data.nextCharge)}
                        </Text>
                        <Tag label={chargeStatusLabel(data.nextCharge.status)} tone={mapChargeTone(chargeStatusTone(data.nextCharge.status))} />
                      </View>
                      <Text style={[styles.amount, { color: theme.accent }]}>
                        {formatCurrency(data.nextCharge.amount)}
                      </Text>
                      {chargeDisplaySubtitle(data.nextCharge) ? (
                        <Text style={{ color: theme.accent2, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                          {chargeDisplaySubtitle(data.nextCharge)}
                        </Text>
                      ) : null}
                      <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                        Vence el {formatShortDate(data.nextCharge.due_date)}
                      </Text>
                    </GlassCard>
                  ) : (
                    <GlassCard style={styles.cardGap} variant="accent" accent="green">
                      <Tag label="Al día" tone="green" />
                      <Text style={[styles.cardTitle, { color: theme.text, marginTop: 8 }]}>Sin cuotas pendientes</Text>
                      <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                        No tienes cargos por pagar en este momento.
                      </Text>
                    </GlassCard>
                  )}

                  {data.upcomingReservation ? (
                    <GlassCard
                      style={styles.cardGap}
                      variant="accent"
                      accent={data.upcomingReservation.status === 'pending' ? 'orange' : 'blue'}
                    >
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                          {data.upcomingReservation.status === 'pending'
                            ? 'Reserva pendiente'
                            : 'Reserva confirmada'}
                        </Text>
                        <Tag
                          label={data.upcomingReservation.status === 'pending' ? 'Pendiente' : 'Activa'}
                          tone={data.upcomingReservation.status === 'pending' ? 'orange' : 'green'}
                        />
                      </View>
                      <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                        {data.upcomingReservation.amenity_name} · {formatDateTime(data.upcomingReservation.starts_at)}
                      </Text>
                    </GlassCard>
                  ) : null}

                  {data.latestPost ? (
                    <GlassCard
                      style={styles.cardGap}
                      variant={data.latestPost.is_pinned ? 'accent' : 'default'}
                      accent="purple"
                    >
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                          {data.latestPost.is_pinned ? 'Aviso destacado' : 'Comunidad'}
                        </Text>
                        <Tag label="Nuevo" tone="blue" />
                      </View>
                      <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                        {data.latestPost.body
                          ? `${data.latestPost.title} — ${data.latestPost.body}`
                          : data.latestPost.title}
                      </Text>
                    </GlassCard>
                  ) : null}

                  {data.pendingPackage ? (
                    <GlassCard style={styles.cardGap} variant="accent" accent="orange">
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Paquete en recepción</Text>
                        <Tag label="Nuevo" tone="red" />
                      </View>
                      <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                        {data.pendingPackage.carrier
                          ? `${data.pendingPackage.carrier}${data.pendingPackage.tracking_number ? ` · ${data.pendingPackage.tracking_number}` : ''}`
                          : 'Tienes un paquete pendiente de recoger en caseta.'}
                      </Text>
                    </GlassCard>
                  ) : null}
                </>
              )}
            </View>

            <SectionLabel title="Accesos rápidos" />
            <View style={styles.quickGrid}>
              {[
                { label: 'Comunidad', emoji: '💬', route: '/community' },
                { label: 'Espacios', emoji: '🏊', route: '/spaces' },
                { label: 'Finanzas', emoji: '💳', route: '/finance' },
                { label: 'Seguridad', emoji: '🔒', route: '/security' },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)} style={styles.quickItem}>
                  <GlassCard style={styles.quickCard} variant="muted">
                    <Text style={styles.quickEmoji}>{item.emoji}</Text>
                    <Text style={[styles.quickLabel, { color: theme.text }]}>{item.label}</Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 13 },
  title: { fontSize: 26, lineHeight: 32, marginTop: 2 },
  subtitle: { fontSize: 12, marginTop: 4 },
  loader: { marginTop: 40 },
  statsWrap: { paddingVertical: 8, marginBottom: 4 },
  statsScroll: { overflow: 'visible' },
  statsRow: { gap: 10, paddingVertical: 4 },
  section: { marginBottom: 8 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  amount: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  quickItem: { width: '47%' },
  quickCard: { alignItems: 'center', paddingVertical: 18 },
  quickEmoji: { fontSize: 24, marginBottom: 6 },
  quickLabel: { fontSize: 12, fontWeight: '600' },
});
