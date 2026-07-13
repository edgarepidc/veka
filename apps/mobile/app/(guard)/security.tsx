import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STAFF_ROLE_LABELS,
  amenityScopeLabel,
  formatVisitVehicle,
  matchesClusterResourceScope,
} from '@veka/shared';
import type { MembershipRole } from '@veka/shared';

import { Avatar, ScreenHeader, SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { KeyboardFormSheet, keyboardFormSheetStyles } from '@/components/ui/KeyboardFormSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScopeFilterBar } from '@/components/ui/ScopeFilterBar';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { VisitQrScanner } from '@/components/VisitQrScanner';
import { useCondominiumClusters } from '@/hooks/useCondominiumClusters';
import { useGuardSecurity } from '@/hooks/useGuardSecurity';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { packageAccentTone, visitAccentTone, visitStatusLabel, visitTagTone } from '@/lib/card-accent';
import { pickImageFromLibrary } from '@/lib/pick-image';
import { useAuth } from '@/providers/AuthProvider';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GuardSecurityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { primary, loading: membershipLoading } = useMembership();
  const { scopeFilterItems, hasClusters, loading: clustersLoading } = useCondominiumClusters(primary);
  const {
    visits,
    packages,
    units,
    loading,
    refreshing,
    actionError,
    refresh,
    checkInVisit,
    checkOutVisit,
    registerPackage,
    deliverPackage,
    getPackagePhotoUrl,
  } = useGuardSecurity(primary);

  const [tab, setTab] = useState('scan');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [manualRef, setManualRef] = useState('');
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [packageSheetOpen, setPackageSheetOpen] = useState(false);
  const [deliverSheetOpen, setDeliverSheetOpen] = useState(false);
  const [deliverPackageId, setDeliverPackageId] = useState<string | null>(null);
  const [deliveredTo, setDeliveredTo] = useState('');
  const [unitId, setUnitId] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string; name?: string } | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Guardia';
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel = STAFF_ROLE_LABELS[(primary?.role ?? 'guard') as MembershipRole] ?? 'Guardia';

  const scopedUnits = useMemo(
    () => units.filter((unit) => matchesClusterResourceScope(unit.cluster_id, scopeFilter)),
    [scopeFilter, units],
  );

  const visibleUnits = useMemo(() => {
    const needle = unitQuery.trim().toLowerCase();
    if (!needle) return scopedUnits;
    return scopedUnits.filter((unit) => unit.identifier.toLowerCase().includes(needle));
  }, [scopedUnits, unitQuery]);

  const visibleVisits = useMemo(
    () =>
      visits.filter((visit) =>
        matchesClusterResourceScope(visit.unit?.cluster_id ?? null, scopeFilter),
      ),
    [scopeFilter, visits],
  );

  const visiblePackages = useMemo(
    () =>
      packages.filter((pkg) =>
        matchesClusterResourceScope(pkg.unit?.cluster_id ?? null, scopeFilter),
      ),
    [packages, scopeFilter],
  );

  useEffect(() => {
    if (unitId && !scopedUnits.some((unit) => unit.id === unitId)) {
      setUnitId('');
    }
  }, [scopedUnits, unitId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        visiblePackages.map(async (pkg) => {
          if (!pkg.photo_url) return;
          const url = await getPackagePhotoUrl(pkg.photo_url);
          if (url) next[pkg.id] = url;
        }),
      );
      if (!cancelled) setPhotoUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [getPackagePhotoUrl, visiblePackages]);

  async function handleValidateRef(raw?: string) {
    const payload = (raw ?? manualRef).trim();
    if (!payload) return;
    Keyboard.dismiss();
    setScanning(true);
    setScanError(null);
    setCheckInResult(null);
    const result = await checkInVisit(payload);
    setScanning(false);
    if (result.error) {
      setScanError(result.error);
      return;
    }
    if (result.result) {
      const prefix = result.result.alreadyCheckedIn ? 'Ya dentro' : 'Ingreso autorizado';
      setCheckInResult(
        `${prefix}: ${result.result.visitorName} · Unidad ${result.result.unitIdentifier} · ${result.result.visitType}`,
      );
      setManualRef('');
    }
  }

  async function handlePickPhoto() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setPhoto({ uri: picked.uri, mimeType: picked.mimeType, name: picked.name });
  }

  async function handleRegisterPackage() {
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await registerPackage({
      unitId,
      carrier,
      trackingNumber,
      notes: packageNotes,
      photoUri: photo?.uri,
      photoMime: photo?.mimeType,
      photoName: photo?.name,
    });
    setSubmitting(false);
    if (!result.error) {
      setPackageSheetOpen(false);
      setUnitId('');
      setUnitQuery('');
      setCarrier('');
      setTrackingNumber('');
      setPackageNotes('');
      setPhoto(null);
      setTab('ops');
    }
  }

  async function handleDeliverPackage() {
    if (!deliverPackageId) return;
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await deliverPackage(deliverPackageId, deliveredTo);
    setSubmitting(false);
    if (!result.error) {
      setDeliverSheetOpen(false);
      setDeliverPackageId(null);
      setDeliveredTo('');
    }
  }

  if (membershipLoading || clustersLoading || loading) {
    return (
      <ScreenBackground style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ScreenBackground>
    );
  }

  if (!primary?.condominium_id) {
    return (
      <ScreenBackground style={[styles.centered, { padding: 24 }]}>
        <GlassCard>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin acceso</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Tu cuenta no tiene un condominio asignado. Pide al administrador que te invite como guardia.
          </Text>
        </GlassCard>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.headerWrap}>
            <ScreenHeader
              title="Caseta"
              highlight="y acceso"
              subtitle={`${primary.condominium?.name ?? 'Condominio'} · ${roleLabel}`}
            />
          </View>
          <Pressable onPress={() => router.push('/account')} style={styles.avatarBtn}>
            <Avatar initials={initials} color={theme.accent} size={40} />
          </Pressable>
        </View>

        {actionError ? <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text> : null}

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'scan', label: 'Validar pase' },
              { key: 'packages', label: 'Paquetes' },
              { key: 'ops', label: 'Operaciones' },
            ]}
            active={tab}
            onChange={setTab}
          />
          {hasClusters ? (
            <ScopeFilterBar items={scopeFilterItems} active={scopeFilter} onChange={setScopeFilter} />
          ) : null}
        </View>

        {tab === 'scan' ? (
          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Escanear o validar QR</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Abre la cámara para leer el pase del residente, o pega la referencia manualmente.
            </Text>
            <VisitQrScanner
              active={tab === 'scan'}
              onScan={(payload) => {
                void handleValidateRef(payload);
              }}
            />
            <GlassInput
              value={manualRef}
              onChangeText={setManualRef}
              placeholder="Referencia del pase"
              multiline
              style={styles.refInput}
            />
            <PrimaryButton
              label={scanning ? 'Validando…' : 'Validar ingreso'}
              variant="success"
              loading={scanning}
              onPress={() => void handleValidateRef()}
            />
            {scanError ? <Text style={[styles.error, { color: theme.danger }]}>{scanError}</Text> : null}
            {checkInResult ? (
              <Text style={[styles.success, { color: theme.accent }]}>{checkInResult}</Text>
            ) : null}
          </GlassCard>
        ) : null}

        {tab === 'packages' ? (
          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Registrar paquete</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Elige la unidad del alcance activo, opcionalmente adjunta foto y notifica a la unidad.
            </Text>
            <PrimaryButton label="Nuevo paquete" variant="success" onPress={() => setPackageSheetOpen(true)} />
          </GlassCard>
        ) : null}

        {tab === 'ops' ? (
          <View style={styles.section}>
            <SectionLabel title="Visitas vigentes hoy" />
            {visibleVisits.length === 0 ? (
              <GlassCard variant="muted">
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin visitas en este alcance para hoy.</Text>
              </GlassCard>
            ) : (
              visibleVisits.map((visit) => (
                <GlassCard key={visit.id} variant="accent" accent={visitAccentTone(visit)} style={styles.cardGap}>
                  <View style={styles.row}>
                    <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>{visit.visitor_name}</Text>
                    <Tag label={visitStatusLabel(visit, { activeLabel: 'Pendiente' })} tone={visitTagTone(visit)} />
                  </View>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    Unidad {visit.unit?.identifier ?? '—'} ·{' '}
                    {amenityScopeLabel(visit.unit?.cluster_id ?? null, visit.unit?.cluster?.name ?? null, 'Todo')}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    {formatTime(visit.valid_from)} – {formatTime(visit.valid_until)}
                  </Text>
                  {visit.visit_type === 'rental' && visit.stay_days ? (
                    <Text style={[styles.meta, { color: theme.textSubtle }]}>{visit.stay_days} día(s) de renta</Text>
                  ) : null}
                  {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model) ? (
                    <Text style={[styles.meta, { color: theme.textSubtle }]}>
                      {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model)}
                    </Text>
                  ) : null}
                  {visit.notes ? (
                    <Text style={[styles.body, { color: theme.textMuted }]}>{visit.notes}</Text>
                  ) : null}
                  {visit.checked_in_at && !visit.checked_out_at ? (
                    <Pressable onPress={() => void checkOutVisit(visit.id)} style={styles.inlineAction}>
                      <Text style={[styles.link, { color: theme.accent }]}>Registrar salida</Text>
                    </Pressable>
                  ) : null}
                </GlassCard>
              ))
            )}

            <View style={{ marginTop: 20 }}>
              <SectionLabel title="Paquetes en caseta" />
            </View>
            {visiblePackages.length === 0 ? (
              <GlassCard variant="muted">
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin paquetes pendientes en este alcance.</Text>
              </GlassCard>
            ) : (
              visiblePackages.map((pkg) => (
                <GlassCard key={pkg.id} variant="accent" accent={packageAccentTone('received')} style={styles.cardGap}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {pkg.carrier ?? 'Paquete'} · Unidad {pkg.unit?.identifier ?? '—'}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    {amenityScopeLabel(pkg.unit?.cluster_id ?? null, pkg.unit?.cluster?.name ?? null, 'Todo')}
                  </Text>
                  {pkg.tracking_number ? (
                    <Text style={[styles.meta, { color: theme.textSubtle }]}>Guía {pkg.tracking_number}</Text>
                  ) : null}
                  {photoUrls[pkg.id] ? (
                    <Image source={{ uri: photoUrls[pkg.id] }} style={styles.packagePhoto} />
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setDeliverPackageId(pkg.id);
                      setDeliveredTo('');
                      setDeliverSheetOpen(true);
                    }}
                    style={styles.inlineAction}
                  >
                    <Text style={[styles.link, { color: theme.accent }]}>Marcar entregado</Text>
                  </Pressable>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <KeyboardFormSheet visible={packageSheetOpen} onClose={() => setPackageSheetOpen(false)} title="Registrar paquete">
        <GlassInput
          placeholder="Buscar unidad…"
          value={unitQuery}
          onChangeText={setUnitQuery}
        />
        <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>Unidad</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {visibleUnits.map((unit) => (
            <Pressable
              key={unit.id}
              onPress={() => setUnitId(unit.id)}
              style={[
                styles.chip,
                {
                  borderColor: unitId === unit.id ? theme.accent : theme.border,
                  backgroundColor: unitId === unit.id ? `${theme.accent}22` : 'transparent',
                },
              ]}
            >
              <Text style={{ color: unitId === unit.id ? theme.accent : theme.textMuted, fontSize: 12 }}>
                {unit.identifier}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <GlassInput placeholder="Paquetería / carrier" value={carrier} onChangeText={setCarrier} />
        <GlassInput
          placeholder="Número de guía (opcional)"
          value={trackingNumber}
          onChangeText={setTrackingNumber}
        />
        <GlassInput placeholder="Notas (opcional)" value={packageNotes} onChangeText={setPackageNotes} />
        <PrimaryButton
          label={photo ? 'Cambiar foto' : 'Adjuntar foto (opcional)'}
          variant="secondary"
          onPress={() => void handlePickPhoto()}
        />
        {photo?.name ? (
          <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 8 }}>{photo.name}</Text>
        ) : null}
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={() => setPackageSheetOpen(false)} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Registrar y notificar"
              variant="success"
              loading={submitting}
              onPress={() => void handleRegisterPackage()}
            />
          </View>
        </View>
      </KeyboardFormSheet>

      <KeyboardFormSheet
        visible={deliverSheetOpen}
        onClose={() => {
          setDeliverSheetOpen(false);
          setDeliverPackageId(null);
          setDeliveredTo('');
        }}
        title="Entregar paquete"
      >
        <GlassInput
          placeholder="Quién recogió"
          value={deliveredTo}
          onChangeText={setDeliveredTo}
        />
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Cancelar"
              variant="muted"
              onPress={() => {
                setDeliverSheetOpen(false);
                setDeliverPackageId(null);
                setDeliveredTo('');
              }}
            />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Confirmar entrega"
              variant="success"
              loading={submitting}
              onPress={() => void handleDeliverPackage()}
            />
          </View>
        </View>
      </KeyboardFormSheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerWrap: { flex: 1 },
  avatarBtn: { marginTop: 4 },
  section: { marginTop: 16 },
  cardGap: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  error: { marginTop: 12, fontSize: 13 },
  success: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 12, marginTop: 4 },
  refInput: { minHeight: 72, textAlignVertical: 'top' },
  inlineAction: { marginTop: 10 },
  link: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  chips: { marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  packagePhoto: { marginTop: 10, height: 96, width: 140, borderRadius: 12 },
});
