import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { HomeEnter } from '@/components/home/HomeEnter';
import { Avatar } from '@/components/ui/Avatar';
import { BackgroundGradientWashes } from '@/components/ui/BackgroundGradientWashes';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SectionLabel } from '@/components/ui/Avatar';
import { StatPill } from '@/components/ui/StatPill';
import { Tag } from '@/components/ui/Tag';
import { useDashboard } from '@/hooks/useDashboard';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { chargeAccentTone, chargeTagTone } from '@/lib/finance-accent';
import { packageAccentTone, reservationAccentTone } from '@/lib/card-accent';
import { useAuth } from '@/providers/AuthProvider';
function timeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

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
    chargeDisplayTitle,
    chargeDisplaySubtitle,
    formatCurrency,
  } = useDashboard(primary);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Residente';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const avatarUri = resolveStorageImageUrl(
    supabaseUrl,
    profile?.avatar_url,
    STORAGE_BUCKETS.AVATARS,
  );
  const logoUri = resolveStorageImageUrl(
    supabaseUrl,
    primary?.condominium?.branding?.logo_url,
    STORAGE_BUCKETS.BRANDING,
  );

  const brandPrimary = primary?.condominium?.branding?.primary_color?.trim() || theme.accent;
  const brandAccent = primary?.condominium?.branding?.accent_color?.trim() || theme.accent2;

  const washes = useMemo(
    () => [
      {
        id: 'home-wash-primary',
        cx: '12%',
        cy: '8%',
        rx: '70%',
        ry: '42%',
        color: brandPrimary,
        peak: theme.mode === 'dark' ? 0.28 : 0.2,
      },
      {
        id: 'home-wash-accent',
        cx: '92%',
        cy: '18%',
        rx: '55%',
        ry: '36%',
        color: brandAccent,
        peak: theme.mode === 'dark' ? 0.22 : 0.16,
      },
      {
        id: 'home-wash-soft',
        cx: '50%',
        cy: '72%',
        rx: '80%',
        ry: '40%',
        color: brandPrimary,
        peak: theme.mode === 'dark' ? 0.12 : 0.08,
      },
    ],
    [brandAccent, brandPrimary, theme.mode],
  );

  const loading = membershipLoading || dashboardLoading;
  const firstName = displayName.split(' ')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  const greeting = timeOfDayGreeting();

  return (
    <ScreenBackground>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackgroundGradientWashes washes={washes} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={brandPrimary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <HomeEnter delay={0}>
          <PressableScale
            onPress={() => router.push('/account')}
            style={styles.headerRow}
            accessibilityLabel="Abrir mi cuenta"
          >
            <View style={styles.headerText}>
              <Text style={[styles.greeting, { color: theme.textSubtle, fontFamily: theme.sansFamily }]}>
                {greeting}, {firstName}
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
            <View style={styles.headerMedia}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.condoLogo} resizeMode="contain" />
              ) : null}
              <Avatar initials={initials} color={brandPrimary} size={48} imageUri={avatarUri} />
            </View>
          </PressableScale>
        </HomeEnter>

        {loading ? (
          <ActivityIndicator color={brandPrimary} style={styles.loader} />
        ) : (
          <>
            {primary?.unit_id ? (
              <HomeEnter delay={60}>
                <View style={styles.statsWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.statsScroll}
                    contentContainerStyle={styles.statsRow}
                  >
                    <StatPill
                      label="Próximo pago"
                      value={data.nextPayment ? formatCurrency(data.nextPayment.amount) : '—'}
                      sub={data.nextPayment ? formatShortDate(data.nextPayment.due_date) : 'Al día'}
                      valueColor={data.nextPayment?.status === 'overdue' ? theme.danger : brandPrimary}
                    />
                    <StatPill
                      label="Reservas"
                      value={data.upcomingReservation ? '1' : '0'}
                      sub={data.upcomingReservation ? 'activa' : 'sin reservas'}
                      valueColor={brandAccent}
                    />
                    <StatPill
                      label="Paquetes"
                      value={data.pendingPackage ? '1' : '0'}
                      sub={data.pendingPackage ? 'en caseta' : 'ninguno'}
                      valueColor={data.pendingPackage ? theme.accent3 : theme.textMuted}
                    />
                  </ScrollView>
                </View>
              </HomeEnter>
            ) : null}

            <View style={styles.section}>
              {!primary?.unit_id ? (
                <HomeEnter delay={100}>
                  <GlassCard variant="accent" accent="orange">
                    <Tag label="Pendiente" tone="orange" />
                    <Text style={[styles.cardTitle, { color: theme.text, marginTop: 10 }]}>
                      Sin unidad asignada
                    </Text>
                    <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                      Pide a administración que te registre con el mismo correo. Al iniciar sesión, tu acceso
                      se activará automáticamente.
                    </Text>
                  </GlassCard>
                </HomeEnter>
              ) : (
                <>
                  <HomeEnter delay={100}>
                    {data.nextPayment ? (
                      <PressableScale
                        onPress={() => router.push({ pathname: '/finance', params: { tab: 'mi-cuenta' } })}
                      >
                        <GlassCard
                          style={styles.cardGap}
                          variant="accent"
                          accent={chargeAccentTone(data.nextPayment.status)}
                        >
                          <View style={styles.cardTop}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              {data.nextPayment.isInstallment
                                ? data.nextPayment.label
                                : chargeDisplayTitle({
                                    concept: data.nextPayment.concept,
                                    fee_campaign: data.nextPayment.fee_campaign,
                                    recurring_fee: data.nextPayment.recurring_fee,
                                  })}
                            </Text>
                            <Tag
                              label={chargeStatusLabel(data.nextPayment.status)}
                              tone={chargeTagTone(data.nextPayment.status)}
                            />
                          </View>
                          <Text style={[styles.amount, { color: brandPrimary }]}>
                            {formatCurrency(data.nextPayment.amount)}
                          </Text>
                          {!data.nextPayment.isInstallment &&
                          chargeDisplaySubtitle({
                            concept: data.nextPayment.concept,
                            fee_campaign: data.nextPayment.fee_campaign,
                            recurring_fee: data.nextPayment.recurring_fee,
                          }) ? (
                            <Text
                              style={{
                                color: brandAccent,
                                fontSize: 12,
                                fontWeight: '600',
                                marginBottom: 4,
                              }}
                            >
                              {chargeDisplaySubtitle({
                                concept: data.nextPayment.concept,
                                fee_campaign: data.nextPayment.fee_campaign,
                                recurring_fee: data.nextPayment.recurring_fee,
                              })}
                            </Text>
                          ) : null}
                          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                            Vence el {formatShortDate(data.nextPayment.due_date)}
                          </Text>
                          <Text
                            style={{ color: brandAccent, fontSize: 12, fontWeight: '600', marginTop: 8 }}
                          >
                            Ir a pagar →
                          </Text>
                        </GlassCard>
                      </PressableScale>
                    ) : (
                      <GlassCard style={styles.cardGap} variant="accent" accent="green">
                        <Tag label="Al día" tone="green" />
                        <Text style={[styles.cardTitle, { color: theme.text, marginTop: 8 }]}>
                          Sin cuotas pendientes
                        </Text>
                        <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                          No tienes cargos por pagar en este momento.
                        </Text>
                      </GlassCard>
                    )}
                  </HomeEnter>

                  {data.upcomingReservation ? (
                    <HomeEnter delay={160}>
                      <PressableScale onPress={() => router.push('/spaces')}>
                        <GlassCard
                          style={styles.cardGap}
                          variant="accent"
                          accent={reservationAccentTone(data.upcomingReservation.status)}
                        >
                          <View style={styles.cardTop}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              {data.upcomingReservation.status === 'pending'
                                ? 'Reserva pendiente'
                                : 'Reserva confirmada'}
                            </Text>
                            <Tag
                              label={
                                data.upcomingReservation.status === 'pending' ? 'Pendiente' : 'Activa'
                              }
                              tone={data.upcomingReservation.status === 'pending' ? 'orange' : 'green'}
                            />
                          </View>
                          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                            {data.upcomingReservation.amenity_name} ·{' '}
                            {formatDateTime(data.upcomingReservation.starts_at)}
                          </Text>
                        </GlassCard>
                      </PressableScale>
                    </HomeEnter>
                  ) : null}

                  {data.latestPost ? (
                    <HomeEnter delay={200}>
                      <PressableScale onPress={() => router.push('/community')}>
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
                          <Text style={[styles.cardBody, { color: theme.textMuted }]} numberOfLines={3}>
                            {data.latestPost.body
                              ? `${data.latestPost.title} — ${data.latestPost.body}`
                              : data.latestPost.title}
                          </Text>
                        </GlassCard>
                      </PressableScale>
                    </HomeEnter>
                  ) : null}

                  {data.pendingPackage ? (
                    <HomeEnter delay={240}>
                      <PressableScale onPress={() => router.push('/security')}>
                        <GlassCard
                          style={styles.cardGap}
                          variant="accent"
                          accent={packageAccentTone('received')}
                        >
                          <View style={styles.cardTop}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                              Paquete en recepción
                            </Text>
                            <Tag label="Nuevo" tone="red" />
                          </View>
                          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                            {data.pendingPackage.carrier
                              ? `${data.pendingPackage.carrier}${
                                  data.pendingPackage.tracking_number
                                    ? ` · ${data.pendingPackage.tracking_number}`
                                    : ''
                                }`
                              : 'Tienes un paquete pendiente de recoger en caseta.'}
                          </Text>
                        </GlassCard>
                      </PressableScale>
                    </HomeEnter>
                  ) : null}
                </>
              )}
            </View>

            <HomeEnter delay={280}>
              <SectionLabel title="Accesos rápidos" />
              <View style={styles.quickGrid}>
                {[
                  { label: 'Comunidad', emoji: '💬', route: '/community' },
                  { label: 'Espacios', emoji: '🏊', route: '/spaces' },
                  { label: 'Finanzas', emoji: '💳', route: '/finance' },
                  { label: 'Seguridad', emoji: '🔒', route: '/security' },
                  { label: 'Mantenimiento', emoji: '🔧', route: '/maintenance' },
                ].map((item, index) => (
                  <PressableScale
                    key={item.route}
                    onPress={() => router.push(item.route as never)}
                    style={[styles.quickItem, index === 4 ? styles.quickItemWide : null]}
                  >
                    <GlassCard style={styles.quickCard} variant="muted">
                      <Text style={styles.quickEmoji}>{item.emoji}</Text>
                      <Text style={[styles.quickLabel, { color: theme.text }]}>{item.label}</Text>
                    </GlassCard>
                  </PressableScale>
                ))}
              </View>
            </HomeEnter>
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
  headerMedia: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  condoLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  greeting: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, lineHeight: 34, marginTop: 2 },
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
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickItem: { width: '47%' },
  quickItemWide: { width: '47%' },
  quickCard: { alignItems: 'center', paddingVertical: 20 },
  quickEmoji: { fontSize: 26, marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600' },
});
