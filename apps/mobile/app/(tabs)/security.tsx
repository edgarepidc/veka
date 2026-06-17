import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { useMembership } from '@/hooks/useMembership';
import { type VisitRow, useSecurity } from '@/hooks/useSecurity';
import { useTheme } from '@/hooks/useTheme';

function formatVisitRange(from: string, until: string): string {
  const start = new Date(from);
  const end = new Date(until);
  const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function visitStatus(visit: VisitRow): { label: string; tone: 'green' | 'blue' | 'orange' | 'gray' } {
  if (visit.checked_out_at) return { label: 'Salió', tone: 'gray' };
  if (visit.checked_in_at) return { label: 'Dentro', tone: 'green' };
  const now = Date.now();
  if (new Date(visit.valid_until).getTime() < now) return { label: 'Expirado', tone: 'orange' };
  return { label: 'Activo', tone: 'blue' };
}

function visitTypeLabel(type: VisitRow['visit_type']): string {
  if (type === 'service') return 'Servicio';
  if (type === 'rental') return 'Renta';
  return 'Visita';
}

export default function SecurityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const { visits, packages, loading, refreshing, actionError, refresh, createVisit } = useSecurity(primary);

  const [tab, setTab] = useState('visitas');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitType, setVisitType] = useState<VisitRow['visit_type']>('visit');
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  const activeVisit = useMemo(() => {
    const selected = visits.find((v) => v.id === selectedVisitId);
    if (selected) return selected;
    return visits.find((v) => !v.checked_out_at && new Date(v.valid_until).getTime() > Date.now()) ?? visits[0] ?? null;
  }, [selectedVisitId, visits]);

  async function handleCreateVisit() {
    if (!visitorName.trim()) return;
    setSubmitting(true);
    const result = await createVisit({
      visitorName,
      visitorPhone,
      visitType,
      hoursValid: 24,
    });
    setSubmitting(false);
    if (!result.error) {
      setSheetOpen(false);
      setVisitorName('');
      setVisitorPhone('');
      setVisitType('visit');
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
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Seguridad"
          highlight="y acceso"
          subtitle={`Unidad ${primary.unit?.identifier}`}
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
              <PrimaryButton label="+ Nueva visita" onPress={() => setSheetOpen(true)} style={{ marginBottom: 14 }} />
              {actionError ? <Text style={{ color: theme.danger, marginBottom: 8 }}>{actionError}</Text> : null}
              {visits.length === 0 ? (
                <GlassCard>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin visitas registradas</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    Pre-autoriza visitas, servicios o rentas. El guardia escanea el QR al ingreso.
                  </Text>
                </GlassCard>
              ) : (
                visits.map((visit) => {
                  const status = visitStatus(visit);
                  return (
                    <Pressable key={visit.id} onPress={() => { setSelectedVisitId(visit.id); setTab('qr'); }}>
                      <GlassCard style={styles.cardGap}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{visit.visitor_name}</Text>
                          <Tag label={status.label} tone={status.tone} />
                        </View>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          {visitTypeLabel(visit.visit_type)} · {formatVisitRange(visit.valid_from, visit.valid_until)}
                        </Text>
                        {visit.visitor_phone ? (
                          <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 4 }}>{visit.visitor_phone}</Text>
                        ) : null}
                      </GlassCard>
                    </Pressable>
                  );
                })
              )}
            </>
          ) : null}

          {tab === 'qr' ? (
            activeVisit ? (
              <GlassCard style={{ alignItems: 'center' }}>
                <Tag label={visitTypeLabel(activeVisit.visit_type)} tone="blue" />
                <Text style={[styles.qrName, { color: theme.text, fontFamily: theme.serifFamily }]}>
                  {activeVisit.visitor_name}
                </Text>
                <View style={[styles.qrBox, { borderColor: theme.glassBorder, backgroundColor: theme.glassDeep }]}>
                  <Text style={[styles.qrToken, { color: theme.text }]}>{activeVisit.qr_token}</Text>
                </View>
                <Text style={[styles.qrHint, { color: theme.textMuted }]}>
                  Muestra este código en caseta. Válido hasta{' '}
                  {new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
                    new Date(activeVisit.valid_until),
                  )}
                </Text>
                <Tag label={visitStatus(activeVisit).label} tone={visitStatus(activeVisit).tone} />
              </GlassCard>
            ) : (
              <GlassCard>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin QR activo</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Registra una visita para generar un código de acceso.
                </Text>
              </GlassCard>
            )
          ) : null}

          {tab === 'paquetes' ? (
            packages.length === 0 ? (
              <GlassCard>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin paquetes</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Cuando recepción registre un paquete para tu unidad, aparecerá aquí.
                </Text>
              </GlassCard>
            ) : (
              packages.map((pkg) => {
                const tone =
                  pkg.status === 'received' ? 'orange' : pkg.status === 'delivered' ? 'green' : 'gray';
                const label =
                  pkg.status === 'received' ? 'En caseta' : pkg.status === 'delivered' ? 'Entregado' : 'Devuelto';
                return (
                  <GlassCard key={pkg.id} style={styles.cardGap}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {pkg.carrier ?? 'Paquete'}
                      </Text>
                      <Tag label={label} tone={tone} />
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
                  </GlassCard>
                );
              })
            )
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: theme.textSubtle }]} />
            <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: theme.serifFamily }]}>
              Nueva visita
            </Text>
            <GlassInput placeholder="Nombre del visitante" value={visitorName} onChangeText={setVisitorName} />
            <GlassInput
              placeholder="Teléfono (opcional)"
              value={visitorPhone}
              onChangeText={setVisitorPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.typeRow}>
              {(['visit', 'service', 'rental'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setVisitType(type)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: visitType === type ? `${theme.accent}22` : theme.glassDeep,
                      borderColor: visitType === type ? theme.accent : theme.glassBorder,
                    },
                  ]}
                >
                  <Text style={{ color: visitType === type ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {visitTypeLabel(type)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label="Generar QR" loading={submitting} onPress={() => void handleCreateVisit()} />
            <PrimaryButton label="Cancelar" variant="secondary" onPress={() => setSheetOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, marginTop: 6, lineHeight: 20 },
  qrName: { fontSize: 22, marginTop: 12, marginBottom: 16 },
  qrBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  qrToken: { fontSize: 22, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  qrHint: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 12, paddingHorizontal: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16, opacity: 0.35 },
  sheetTitle: { fontSize: 22, marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
});
