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
import { HomeInsightBanner } from '@/components/home/HomeInsightBanner';
import { HomeSpacesCard } from '@/components/home/HomeSpacesCard';
import { HomeVisitsCard } from '@/components/home/HomeVisitsCard';
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
    formatTime,
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

  const accountSubtitle =
    data.balanceDue > 0
      ? `Saldo pendiente ${formatCurrency(data.balanceDue)} · Pagado mes ${formatCurrency(data.paidThisMonth)}`
      : `Al día · Pagado este mes ${formatCurrency(data.paidThisMonth)}`;

  const accountHighlight = data.nextPayment
    ? formatCurrency(data.nextPayment.amount)
    : data.balanceDue > 0
      ? formatCurrency(data.balanceDue)
      : null;

  const accountHighlightLabel = data.nextPayment
    ? 'Próxima cuota'
    : data.balanceDue > 0
      ? 'Por pagar'
      : null;

  const spaceItems = data.upcomingReservations.slice(0, 2).map((reservation) => ({
    id: reservation.id,
    name: reservation.amenity_name,
    when: formatDateTime(reservation.starts_at),
    imageUrl: reservation.amenity_image_url,
    status: reservation.status,
  }));

  const visitItems = data.todayVisits.slice(0, 2).map((visit) => ({
    id: visit.id,
    name: visit.visitor_name,
    when: `${formatTime(visit.valid_from)} – ${formatTime(visit.valid_until)}`,
    typeLabel: visit.visit_type_label,
    status: visit.status,
    statusLabel: visit.status_label,
  }));

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
                      shadow="subtle"
                    />
                    <StatPill
                      label="Pagado mes"
                      value={formatCurrency(data.paidThisMonth)}
                      sub="aprobado"
                      valueColor={theme.accent2}
                      shadow="subtle"
                    />
                    <StatPill
                      label="Reservas"
                      value={String(data.upcomingReservations.length)}
                      sub={data.upcomingReservations.length ? 'próximas' : 'ninguna'}
                      valueColor={theme.accent3}
                      shadow="subtle"
                    />
                    <StatPill
                      label="Tickets"
                      value={String(data.openTicketCount)}
                      sub="abiertos"
                      valueColor={data.openTicketCount > 0 ? theme.warning : theme.textMuted}
                      shadow="subtle"
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
                    {data.nextPayment ? (
                      <HomeInsightBanner
                        kind="due"
                        tone={data.nextPayment.status === 'overdue' ? 'danger' : 'warning'}
                        title={
                          data.nextPayment.isInstallment
                            ? data.nextPayment.label
                            : chargeDisplayTitle({
                                concept: data.nextPayment.concept,
                                fee_campaign: data.nextPayment.fee_campaign,
                                recurring_fee: data.nextPayment.recurring_fee,
                              })
                        }
                        subtitle={`${formatCurrency(data.nextPayment.amount)} · Vence el ${formatShortDate(data.nextPayment.due_date)}${
                          !data.nextPayment.isInstallment &&
                          chargeDisplaySubtitle({
                            concept: data.nextPayment.concept,
                            fee_campaign: data.nextPayment.fee_campaign,
                            recurring_fee: data.nextPayment.recurring_fee,
                          })
                            ? ` · ${chargeDisplaySubtitle({
                                concept: data.nextPayment.concept,
                                fee_campaign: data.nextPayment.fee_campaign,
                                recurring_fee: data.nextPayment.recurring_fee,
                              })}`
                            : ''
                        }`}
                        onPress={() =>
                          router.push({ pathname: '/finance', params: { tab: 'mi-cuenta' } })
                        }
                      />
                    ) : (
                      <HomeInsightBanner
                        kind="paid"
                        tone="success"
                        title="Sin cuotas pendientes"
                        subtitle={
                          data.paidThisMonth > 0
                            ? `Este mes llevas pagado ${formatCurrency(data.paidThisMonth)}.`
                            : 'Tu unidad está al día. Sin cargos por pagar.'
                        }
                        onPress={() =>
                          router.push({ pathname: '/finance', params: { tab: 'mi-cuenta' } })
                        }
                      />
                    )}
                  </HomeEnter>

                  <HomeEnter delay={120}>
                    <HomeInsightBanner
                      kind="account"
                      tone={data.balanceDue > 0 || data.nextPayment ? 'warning' : 'info'}
                      title="Tu cuenta"
                      subtitle={accountSubtitle}
                      highlight={accountHighlight}
                      highlightLabel={accountHighlightLabel}
                      onPress={() => router.push('/finance')}
                    />
                  </HomeEnter>

                  <HomeEnter delay={160}>
                    <HomeSpacesCard items={spaceItems} onPress={() => router.push('/spaces')} />
                  </HomeEnter>

                  <HomeEnter delay={180}>
                    <HomeVisitsCard items={visitItems} onPress={() => router.push('/security')} />
                  </HomeEnter>

                  {data.pendingPackage ? (
                    <HomeEnter delay={200}>
                      <HomeInsightBanner
                        kind="package"
                        tone="danger"
                        title="Paquete en recepción"
                        subtitle={
                          data.pendingPackage.carrier
                            ? `${data.pendingPackage.carrier}${
                                data.pendingPackage.tracking_number
                                  ? ` · ${data.pendingPackage.tracking_number}`
                                  : ''
                              }`
                            : 'Tienes un paquete pendiente de recoger en caseta.'
                        }
                        trailingImageUri={data.pendingPackage.photo_url}
                        onPress={() => router.push('/security')}
                      />
                    </HomeEnter>
                  ) : null}

                  {data.latestPost ? (
                    <HomeEnter delay={240}>
                      <HomeInsightBanner
                        kind="notice"
                        tone="purple"
                        title={
                          data.latestPost.post_type === 'poll'
                            ? 'Encuesta en comunidad'
                            : data.latestPost.is_pinned
                              ? 'Aviso destacado'
                              : 'Nuevo en comunidad'
                        }
                        subtitle={
                          data.latestPost.body
                            ? `${data.latestPost.title} — ${data.latestPost.body}`
                            : data.latestPost.title
                        }
                        trailingImageUri={
                          data.latestPost.post_type === 'poll' ? null : data.latestPost.image_url
                        }
                        pollBars={
                          data.latestPost.post_type === 'poll' ? data.latestPost.pollOptions : null
                        }
                        onPress={() => router.push('/community')}
                      />
                    </HomeEnter>
                  ) : null}

                  {data.openTicketCount > 0 ? (
                    <HomeEnter delay={280}>
                      <HomeInsightBanner
                        kind="maintenance"
                        tone="warning"
                        title="Mantenimiento pendiente"
                        subtitle={`Tienes ${data.openTicketCount} ticket${
                          data.openTicketCount === 1 ? '' : 's'
                        } abierto${data.openTicketCount === 1 ? '' : 's'}. Revisa estado o agrega evidencia.`}
                        onPress={() => router.push('/maintenance')}
                      />
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
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
});
