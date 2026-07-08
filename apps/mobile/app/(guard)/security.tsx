import { useState } from 'react';
import {
  ActivityIndicator,
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
import { STAFF_ROLE_LABELS, formatVisitVehicle } from '@veka/shared';
import type { MembershipRole } from '@veka/shared';

import { Avatar, ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { KeyboardFormSheet, keyboardFormSheetStyles } from '@/components/ui/KeyboardFormSheet';
import { GradientActionButton } from '@/components/ui/GradientActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { useGuardSecurity } from '@/hooks/useGuardSecurity';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/providers/AuthProvider';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function visitStatusLabel(checkedIn: string | null, checkedOut: string | null): string {
  if (checkedOut) return 'Salió';
  if (checkedIn) return 'Dentro';
  return 'Pendiente';
}

function visitStatusTone(checkedIn: string | null, checkedOut: string | null): 'green' | 'blue' | 'gray' {
  if (checkedOut) return 'gray';
  if (checkedIn) return 'green';
  return 'blue';
}

export default function GuardSecurityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { primary, loading: membershipLoading } = useMembership();
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
  } = useGuardSecurity(primary);

  const [tab, setTab] = useState('scan');
  const [manualRef, setManualRef] = useState('');
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [packageSheetOpen, setPackageSheetOpen] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Guardia';
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel = STAFF_ROLE_LABELS[(primary?.role ?? 'guard') as MembershipRole] ?? 'Guardia';

  async function handleValidateRef() {
    if (!manualRef.trim()) return;
    Keyboard.dismiss();
    setScanning(true);
    setScanError(null);
    setCheckInResult(null);
    const result = await checkInVisit(manualRef.trim());
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

  async function handleRegisterPackage() {
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await registerPackage({
      unitId,
      carrier,
      trackingNumber,
      notes: packageNotes,
    });
    setSubmitting(false);
    if (!result.error) {
      setPackageSheetOpen(false);
      setUnitId('');
      setCarrier('');
      setTrackingNumber('');
      setPackageNotes('');
      setTab('ops');
    }
  }

  if (membershipLoading || loading) {
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

        <View style={styles.section}>
          <GradientActionButton
            label="Registrar paquete"
            icon="cube-outline"
            variant="orange"
            onPress={() => setPackageSheetOpen(true)}
            style={styles.createAction}
          />
        </View>

        {actionError ? <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text> : null}

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'scan', label: 'Validar pase' },
              { key: 'ops', label: 'Operaciones' },
            ]}
            active={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'scan' ? (
          <GlassCard>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Escanear o validar QR</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Pega el JSON del QR o los 32 caracteres de referencia del pase del residente.
            </Text>
            <GlassInput
              value={manualRef}
              onChangeText={setManualRef}
              placeholder="Referencia del pase"
              multiline
              style={styles.refInput}
            />
            <PrimaryButton
              label={scanning ? 'Validando…' : 'Validar ingreso'}
              loading={scanning}
              onPress={() => void handleValidateRef()}
            />
            {scanError ? <Text style={[styles.error, { color: theme.danger }]}>{scanError}</Text> : null}
            {checkInResult ? (
              <Text style={[styles.success, { color: theme.accent }]}>{checkInResult}</Text>
            ) : null}
          </GlassCard>
        ) : null}

        {tab === 'ops' ? (
          <View style={styles.section}>
            <Text style={[styles.dayHeading, { color: theme.accent }]}>Visitas vigentes hoy</Text>
            {visits.length === 0 ? (
              <GlassCard>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin visitas programadas para hoy.</Text>
              </GlassCard>
            ) : (
              visits.map((visit) => (
                <GlassCard key={visit.id} style={styles.cardGap}>
                  <View style={styles.row}>
                    <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>{visit.visitor_name}</Text>
                    <Tag
                      label={visitStatusLabel(visit.checked_in_at, visit.checked_out_at)}
                      tone={visitStatusTone(visit.checked_in_at, visit.checked_out_at)}
                    />
                  </View>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    Unidad {visit.unit?.identifier ?? '—'} · {formatTime(visit.valid_from)} –{' '}
                    {formatTime(visit.valid_until)}
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
                    <Pressable
                      onPress={() => void checkOutVisit(visit.id)}
                      style={styles.inlineAction}
                    >
                      <Text style={[styles.link, { color: theme.accent }]}>Registrar salida</Text>
                    </Pressable>
                  ) : null}
                </GlassCard>
              ))
            )}

            <Text style={[styles.dayHeading, { color: theme.accent, marginTop: 20 }]}>Paquetes en caseta</Text>
            {packages.length === 0 ? (
              <GlassCard>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin paquetes pendientes.</Text>
              </GlassCard>
            ) : (
              packages.map((pkg) => (
                <GlassCard key={pkg.id} style={styles.cardGap}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {pkg.carrier ?? 'Paquete'} · Unidad {pkg.unit?.identifier ?? '—'}
                  </Text>
                  {pkg.tracking_number ? (
                    <Text style={[styles.meta, { color: theme.textSubtle }]}>Guía {pkg.tracking_number}</Text>
                  ) : null}
                  <Pressable
                    onPress={() => void deliverPackage(pkg.id)}
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
        <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>Unidad</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {units.map((unit) => (
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
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="secondary" onPress={() => setPackageSheetOpen(false)} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Registrar y notificar"
              loading={submitting}
              onPress={() => void handleRegisterPackage()}
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
  createAction: { marginBottom: 4 },
  cardGap: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  error: { marginTop: 12, fontSize: 13 },
  success: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  dayHeading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 12, marginTop: 4 },
  refInput: { minHeight: 72, textAlignVertical: 'top' },
  inlineAction: { marginTop: 10 },
  link: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chips: { marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
});
