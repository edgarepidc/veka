import { useMemo, useState, useEffect } from 'react';
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
import {
  DEFAULT_RENTAL_STAY_DAYS,
  RENTAL_OVERDUE_BLOCK_MESSAGE,
  STORAGE_BUCKETS,
  endDateKeyFromStartAndStayDays,
  formatDateKey,
  formatVisitDateRangeLabel,
  formatVisitVehicle,
  todayDateKey,
} from '@veka/shared';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { KeyboardFormSheet, keyboardFormSheetStyles } from '@/components/ui/KeyboardFormSheet';
import { GradientActionButton } from '@/components/ui/GradientActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { VisitQrPass } from '@/components/VisitQrPass';
import { VisitSchedulePicker } from '@/components/VisitSchedulePicker';
import { useMembership } from '@/hooks/useMembership';
import { type VisitRow, useSecurity } from '@/hooks/useSecurity';
import { useTheme } from '@/hooks/useTheme';
import {
  packageAccentTone,
  packageStatusLabel,
  packageTagTone,
  visitAccentTone,
  visitStatusLabel,
  visitTagTone,
} from '@/lib/card-accent';
import { supabase } from '@/lib/supabase';
function formatVisitRange(from: string, until: string): string {
  const startKey = formatDateKey(new Date(from));
  const endKey = formatDateKey(new Date(until));
  return formatVisitDateRangeLabel(startKey, endKey);
}

function visitTypeLabel(type: VisitRow['visit_type']): string {
  if (type === 'service') return 'Servicio';
  if (type === 'rental') return 'Renta';
  return 'Visita';
}

export default function SecurityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { primary, loading: membershipLoading } = useMembership();
  const { visits, packages, loading, refreshing, actionError, rentalBlocked, refresh, createVisit } =
    useSecurity(primary);

  const [tab, setTab] = useState('visitas');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitType, setVisitType] = useState<VisitRow['visit_type']>('visit');
  const [stayDays, setStayDays] = useState(String(DEFAULT_RENTAL_STAY_DAYS));
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [startDate, setStartDate] = useState(todayDateKey());
  const [endDate, setEndDate] = useState(todayDateKey());
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [packagePhotoUrls, setPackagePhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.tab === 'paquetes' || params.tab === 'visitas' || params.tab === 'qr') {
      setTab(params.tab);
    }
  }, [params.tab]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        packages.map(async (pkg) => {
          if (!pkg.photo_url) return;
          if (pkg.photo_url.startsWith('http://') || pkg.photo_url.startsWith('https://')) {
            next[pkg.id] = pkg.photo_url;
            return;
          }
          const { data } = await supabase.storage
            .from(STORAGE_BUCKETS.PACKAGES)
            .createSignedUrl(pkg.photo_url, 3600);
          if (data?.signedUrl) next[pkg.id] = data.signedUrl;
        }),
      );
      if (!cancelled) setPackagePhotoUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [packages]);

  useEffect(() => {
    if (visitType === 'rental') {
      setEndDate(endDateKeyFromStartAndStayDays(startDate, Number(stayDays) || DEFAULT_RENTAL_STAY_DAYS));
    }
  }, [visitType, startDate, stayDays]);

  const activeVisit = useMemo(() => {
    const selected = visits.find((v) => v.id === selectedVisitId);
    if (selected) return selected;
    return visits.find((v) => !v.checked_out_at && new Date(v.valid_until).getTime() > Date.now()) ?? visits[0] ?? null;
  }, [selectedVisitId, visits]);

  function closeSheet() {
    Keyboard.dismiss();
    setSheetOpen(false);
  }

  function resetForm() {
    setVisitorName('');
    setVisitorPhone('');
    setVisitType('visit');
    setStayDays(String(DEFAULT_RENTAL_STAY_DAYS));
    setVehiclePlate('');
    setVehicleModel('');
    setRentalNotes('');
    const today = todayDateKey();
    setStartDate(today);
    setEndDate(today);
  }

  async function handleCreateVisit() {
    if (!visitorName.trim()) return;
    if (visitType === 'rental' && rentalBlocked) return;
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await createVisit({
      visitorName,
      visitorPhone,
      visitType,
      startDate,
      endDate,
      stayDays: visitType === 'rental' ? Number(stayDays) : undefined,
      vehiclePlate: visitType === 'rental' ? vehiclePlate : undefined,
      vehicleModel: visitType === 'rental' ? vehicleModel : undefined,
      notes: visitType === 'rental' ? rentalNotes : undefined,
    });
    setSubmitting(false);
    if (!result.error) {
      setSheetOpen(false);
      resetForm();
      if (result.visitId) setSelectedVisitId(result.visitId);
      setTab('qr');
    }
  }

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
            Necesitas una unidad para registrar visitas y ver paquetes.
          </Text>
        </GlassCard>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Seguridad"
          highlight="y acceso"
          subtitle={`${primary.condominium?.name} · Unidad ${primary.unit?.identifier}`}
        />

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'visitas', label: 'Visitas' },
              { key: 'qr', label: 'QR' },
              { key: 'paquetes', label: 'Paquetes' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'visitas' ? (
            <>
              <GradientActionButton
                label="Nueva visita"
                icon="person-add-outline"
                variant="blue"
                onPress={() => setSheetOpen(true)}
                style={styles.createAction}
              />
              {actionError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{actionError}</Text> : null}
              {visits.length === 0 ? (
                <GlassCard variant="muted">
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin visitas registradas</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    Pre-autoriza visitas, servicios o rentas. El guardia escanea el QR al ingreso.
                  </Text>
                </GlassCard>
              ) : (
                visits.map((visit) => (
                    <Pressable key={visit.id} onPress={() => { setSelectedVisitId(visit.id); setTab('qr'); }}>
                      <GlassCard variant="accent" accent={visitAccentTone(visit)} style={styles.cardGap}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{visit.visitor_name}</Text>
                          <Tag label={visitStatusLabel(visit)} tone={visitTagTone(visit)} />
                        </View>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          {visitTypeLabel(visit.visit_type)} · {formatVisitRange(visit.valid_from, visit.valid_until)}
                          {visit.visit_type === 'rental' && visit.stay_days ? ` · ${visit.stay_days} día(s)` : ''}
                        </Text>
                        {visit.visitor_phone ? (
                          <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 4 }}>{visit.visitor_phone}</Text>
                        ) : null}
                        {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model) ? (
                          <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 4 }}>
                            {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model)}
                          </Text>
                        ) : null}
                        {visit.notes ? (
                          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{visit.notes}</Text>
                        ) : null}
                      </GlassCard>
                    </Pressable>
                  ))
              )}
            </>
          ) : null}

          {tab === 'qr' ? (
            activeVisit ? (
              <VisitQrPass
                visit={activeVisit}
                condominiumName={primary.condominium?.name ?? 'Condominio'}
                unitIdentifier={primary.unit?.identifier ?? '—'}
              />
            ) : (
              <GlassCard variant="muted">
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin QR activo</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Registra una visita para generar un código de acceso.
                </Text>
              </GlassCard>
            )
          ) : null}

          {tab === 'paquetes' ? (
            packages.length === 0 ? (
              <GlassCard variant="muted">
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin paquetes</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Cuando recepción registre un paquete para tu unidad, aparecerá aquí.
                </Text>
              </GlassCard>
            ) : (
              packages.map((pkg) => (
                  <GlassCard key={pkg.id} variant="accent" accent={packageAccentTone(pkg.status)} style={styles.cardGap}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {pkg.carrier ?? 'Paquete'}
                      </Text>
                      <Tag label={packageStatusLabel(pkg.status)} tone={packageTagTone(pkg.status)} />
                    </View>
                    {pkg.tracking_number ? (
                      <Text style={{ color: theme.textMuted, fontSize: 13 }}>Guía: {pkg.tracking_number}</Text>
                    ) : null}
                    <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 4 }}>
                      Recibido{' '}
                      {new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(
                        new Date(pkg.received_at),
                      )}
                    </Text>
                    {pkg.delivered_to ? (
                      <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 4 }}>
                        Entregado a {pkg.delivered_to}
                        {pkg.delivered_at
                          ? ` · ${new Intl.DateTimeFormat('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(pkg.delivered_at))}`
                          : ''}
                      </Text>
                    ) : null}
                    {packagePhotoUrls[pkg.id] ? (
                      <Image source={{ uri: packagePhotoUrls[pkg.id] }} style={styles.packagePhoto} />
                    ) : null}
                  </GlassCard>
                ))
            )
          ) : null}
        </View>
      </ScrollView>

      <KeyboardFormSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="Nueva visita"
        titleStyle={{ fontFamily: theme.serifFamily, fontSize: 22 }}
      >
        <GlassInput
          placeholder="Nombre del visitante"
          value={visitorName}
          onChangeText={setVisitorName}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={Keyboard.dismiss}
        />
        <GlassInput
          placeholder="Teléfono (opcional)"
          value={visitorPhone}
          onChangeText={setVisitorPhone}
          keyboardType="phone-pad"
        />
        <View style={styles.typeRow}>
          {(['visit', 'service', 'rental'] as const).map((type) => {
            const disabled = type === 'rental' && rentalBlocked;
            return (
            <Pressable
              key={type}
              onPress={() => !disabled && setVisitType(type)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: visitType === type ? `${theme.accent}22` : theme.glassDeep,
                  borderColor: visitType === type ? theme.accent : theme.glassBorder,
                  opacity: disabled ? 0.45 : 1,
                },
              ]}
            >
              <Text style={{ color: visitType === type ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: '600' }}>
                {visitTypeLabel(type)}
              </Text>
            </Pressable>
            );
          })}
        </View>
        {rentalBlocked ? (
          <Text style={{ color: theme.danger, fontSize: 12, marginBottom: 8 }}>{RENTAL_OVERDUE_BLOCK_MESSAGE}</Text>
        ) : null}
        <VisitSchedulePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          stayDays={visitType === 'rental' ? Number(stayDays) || DEFAULT_RENTAL_STAY_DAYS : undefined}
        />
        {visitType === 'rental' ? (
          <>
            <GlassInput
              placeholder="Días de estancia"
              value={stayDays}
              onChangeText={setStayDays}
              keyboardType="number-pad"
            />
            <GlassInput
              placeholder="Placas del vehículo (opcional)"
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              autoCapitalize="characters"
            />
            <GlassInput
              placeholder="Marca, modelo y color del auto"
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />
            <GlassInput
              placeholder="Comentarios adicionales de la renta"
              value={rentalNotes}
              onChangeText={setRentalNotes}
              multiline
              style={keyboardFormSheetStyles.textArea}
            />
          </>
        ) : null}
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={closeSheet} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Generar QR"
              variant="success"
              loading={submitting}
              onPress={() => void handleCreateVisit()}
              disabled={visitType === 'rental' && rentalBlocked}
            />
          </View>
        </View>
      </KeyboardFormSheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  createAction: { marginTop: 14, marginBottom: 14 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, marginTop: 6, lineHeight: 20 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeChip: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  packagePhoto: { marginTop: 10, height: 96, width: 140, borderRadius: 12 },
});
