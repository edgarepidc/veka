import { router } from 'expo-router';
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
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StatPill } from '@/components/ui/StatPill';
import { Tag } from '@/components/ui/Tag';
import { useDashboard } from '@/hooks/useDashboard';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { chargeAccentTone, chargeTagTone } from '@/lib/finance-accent';
import { packageAccentTone } from '@/lib/card-accent';
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

  const loading = membershipLoading || dashboardLoading;
  const firstName = displayName.split(' ')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  const greeting = timeOfDayGreeting();
  const maxBar = Math.max(...data.chargeBars.map((bar) => bar.value), data.paidThisMonth, 1);

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />
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
              <Avatar initials={initials} color={theme.accent} size={48} imageUri={avatarUri} />
            </View>
          </PressableScale>
        </HomeEnter>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <>
            {primary?.unit_id ? (
              <HomeEnter delay={40}>
                <View style={styles.statsWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statsRow}
                  >
                    <StatPill
                      label="Saldo"
                      value={data.balanceDue > 0 ? formatCurrency(data.balanceDue) : 'Al día'}
                      sub={data.nextPayment ? formatShortDate(data.nextPayment.due_date) : 'sin adeudo'}
                      valueColor={data.balanceDue > 0 ? theme.danger : theme.accent}
                    />
                    <StatPill
                      label="Pagado mes"
                      value={formatCurrency(data.paidThisMonth)}
                      sub="aprobado"
                      valueColor={theme.accent2}
                    />
                    <StatPill
                      label="Reservas"
                      value={String(data.upcomingReservations.length)}
                      sub={data.upcomingReservations.length ? 'próximas' : 'ninguna'}
                      valueColor={theme.accent3}
                    />
                    <StatPill
                      label="Tickets"
                      value={String(data.openTicketCount)}
                      sub="abiertos"
                      valueColor={data.openTicketCount > 0 ? theme.warning : theme.textMuted}
                    />
                  </ScrollView>
                </View>
              </HomeEnter>
            ) : null}

            <View style={styles.section}>
              {!primary?.unit_id ? (
                <HomeEnter delay={80}>
                  <GlassCard variant="muted">
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
                  <HomeEnter delay={80}>
                    <PressableScale
                      onPress={() => router.push({ pathname: '/finance', params: { tab: 'mi-cuenta' } })}
                    >
                      <GlassCard
                        style={styles.cardGap}
                        variant={data.nextPayment ? 'accent' : 'default'}
                        accent={
                          data.nextPayment ? chargeAccentTone(data.nextPayment.status) : 'blue'
                        }
                      >
                        {data.nextPayment ? (
                          <>
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
                            <Text style={[styles.amount, { color: theme.text }]}>
                              {formatCurrency(data.nextPayment.amount)}
                            </Text>
                            {!data.nextPayment.isInstallment &&
                            chargeDisplaySubtitle({
                              concept: data.nextPayment.concept,
                              fee_campaign: data.nextPayment.fee_campaign,
                              recurring_fee: data.nextPayment.recurring_fee,
                            }) ? (
                              <Text style={{ color: theme.accent2, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
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
                            <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
                              Ir a pagar →
                            </Text>
                          </>
                        ) : (
                          <>
                            <Tag label="Al día" tone="blue" />
                            <Text style={[styles.cardTitle, { color: theme.text, marginTop: 8 }]}>
                              Sin cuotas pendientes
                            </Text>
                            <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                              Este mes llevas pagado {formatCurrency(data.paidThisMonth)}.
                            </Text>
                          </>
                        )}
                      </GlassCard>
                    </PressableScale>
                  </HomeEnter>

                  <HomeEnter delay={120}>
                    <GlassCard style={styles.cardGap} variant="muted">
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Tu cuenta</Text>
                        <PressableScale onPress={() => router.push('/finance')}>
                          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>Ver →</Text>
                        </PressableScale>
                      </View>
                      <View style={styles.metricRow}>
                        <View style={styles.metricBox}>
                          <Text style={[styles.metricLabel, { color: theme.textSubtle }]}>Por pagar</Text>
                          <Text style={[styles.metricValue, { color: theme.text }]}>
                            {formatCurrency(data.balanceDue)}
                          </Text>
                        </View>
                        <View style={styles.metricBox}>
                          <Text style={[styles.metricLabel, { color: theme.textSubtle }]}>Pagado mes</Text>
                          <Text style={[styles.metricValue, { color: theme.text }]}>
                            {formatCurrency(data.paidThisMonth)}
                          </Text>
                        </View>
                      </View>
                      {data.chargeBars.length > 0 ? (
                        <View style={styles.bars}>
                          {data.chargeBars.map((bar) => (
                            <View key={`${bar.label}-${bar.value}`} style={styles.barRow}>
                              <Text style={[styles.barLabel, { color: theme.textMuted }]} numberOfLines={1}>
                                {bar.label}
                              </Text>
                              <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                                <View
                                  style={[
                                    styles.barFill,
                                    {
                                      backgroundColor: theme.accent2,
                                      width: `${Math.max(6, (bar.value / maxBar) * 100)}%`,
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={[styles.barValue, { color: theme.text }]}>
                                {formatCurrency(bar.value)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                          No hay cargos abiertos en tu unidad.
                        </Text>
                      )}
                    </GlassCard>
                  </HomeEnter>

                  <HomeEnter delay={160}>
                    <GlassCard style={styles.cardGap} variant="muted">
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Espacios</Text>
                        <PressableScale onPress={() => router.push('/spaces')}>
                          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>Ver →</Text>
                        </PressableScale>
                      </View>
                      {data.upcomingReservations.length === 0 ? (
                        <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                          Sin reservas próximas. Reserva un amenity cuando lo necesites.
                        </Text>
                      ) : (
                        data.upcomingReservations.map((reservation) => (
                          <View key={reservation.id} style={styles.listRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                                {reservation.amenity_name}
                              </Text>
                              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                                {formatDateTime(reservation.starts_at)}
                              </Text>
                            </View>
                            <Tag
                              label={reservation.status === 'pending' ? 'Pendiente' : 'Activa'}
                              tone={reservation.status === 'pending' ? 'orange' : 'blue'}
                            />
                          </View>
                        ))
                      )}
                    </GlassCard>
                  </HomeEnter>

                  {data.pendingPackage ? (
                    <HomeEnter delay={200}>
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

                  {data.latestPost ? (
                    <HomeEnter delay={240}>
                      <PressableScale onPress={() => router.push('/community')}>
                        <GlassCard style={styles.cardGap} variant="default">
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

                  {data.openTicketCount > 0 ? (
                    <HomeEnter delay={280}>
                      <PressableScale onPress={() => router.push('/maintenance')}>
                        <GlassCard style={styles.cardGap} variant="accent" accent="orange">
                          <View style={styles.cardTop}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Mantenimiento</Text>
                            <Tag label={`${data.openTicketCount} abiertos`} tone="orange" />
                          </View>
                          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
                            Tienes tickets activos. Revisa el estado o agrega evidencia.
                          </Text>
                        </GlassCard>
                      </PressableScale>
                    </HomeEnter>
                  ) : null}
                </>
              )}
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
  headerMedia: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  condoLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
  },
  greeting: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, lineHeight: 34, marginTop: 2 },
  subtitle: { fontSize: 12, marginTop: 4 },
  loader: { marginTop: 40 },
  statsWrap: { paddingVertical: 4, marginBottom: 8 },
  statsRow: { gap: 10, paddingVertical: 4 },
  section: { marginBottom: 8 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  amount: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metricBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F7F7F7',
  },
  metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  bars: { marginTop: 14, gap: 10 },
  barRow: { gap: 4 },
  barLabel: { fontSize: 11 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { fontSize: 11, fontWeight: '600' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEBEB',
    marginTop: 10,
  },
});
