import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAINTENANCE_TICKET_CATEGORIES,
  ticketCategoryLabel,
  ticketStatusLabel,
} from '@veka/shared';
import type { MaintenanceTicketCategory } from '@veka/shared';

import { ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TabStrip } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';
import { pickImageFromLibrary } from '@/lib/pick-image';

function statusTone(status: string): 'green' | 'blue' | 'orange' | 'gray' {
  if (status === 'resolved' || status === 'closed') return 'green';
  if (status === 'in_progress') return 'blue';
  if (status === 'open') return 'orange';
  return 'gray';
}

export default function MaintenanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const { tickets, schedules, workLogs, loading, refreshing, actionError, refresh, createTicket, getSignedUrl } =
    useMaintenance(primary);

  const [tab, setTab] = useState('tickets');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaintenanceTicketCategory>('unit');
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string; name?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickPhoto() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setPhoto({ uri: picked.uri, mimeType: picked.mimeType, name: picked.name });
  }

  async function handleCreateTicket() {
    if (!title.trim()) return;
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await createTicket({
      title,
      description,
      category,
      photoUri: photo?.uri,
      photoMime: photo?.mimeType,
      photoName: photo?.name,
    });
    setSubmitting(false);
    if (!result.error) {
      setSheetOpen(false);
      setTitle('');
      setDescription('');
      setCategory('unit');
      setPhoto(null);
    }
  }

  async function openFile(path: string) {
    const url = await getSignedUrl(path);
    if (url) await Linking.openURL(url);
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
            Necesitas una unidad para reportar desperfectos.
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
          title="Mantenimiento"
          highlight="y reportes"
          subtitle={`Unidad ${primary.unit?.identifier}`}
        />

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'tickets', label: 'Mis tickets' },
              { key: 'calendarios', label: 'Calendarios' },
              { key: 'evidencia', label: 'Evidencia' },
            ]}
            active={tab}
            onChange={setTab}
          />
        </View>

        {actionError ? (
          <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text>
        ) : null}

        {tab === 'tickets' ? (
          <View style={styles.section}>
            <PrimaryButton label="Nuevo reporte" onPress={() => setSheetOpen(true)} />
            {tickets.length === 0 ? (
              <GlassCard style={styles.mt}>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>No tienes tickets todavía.</Text>
              </GlassCard>
            ) : (
              tickets.map((ticket) => (
                <GlassCard key={ticket.id} style={styles.mt}>
                  <View style={styles.row}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{ticket.title}</Text>
                    <Tag label={ticketStatusLabel(ticket.status)} tone={statusTone(ticket.status)} />
                  </View>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    {ticketCategoryLabel(ticket.category)} · {new Date(ticket.created_at).toLocaleDateString('es-MX')}
                  </Text>
                  {ticket.description ? (
                    <Text style={[styles.body, { color: theme.textMuted }]}>{ticket.description}</Text>
                  ) : null}
                  {ticket.admin_notes ? (
                    <Text style={[styles.note, { color: theme.accent }]}>
                      Administración: {ticket.admin_notes}
                    </Text>
                  ) : null}
                  {ticket.photo_url ? (
                    <Pressable onPress={() => void openFile(ticket.photo_url!)}>
                      <Text style={[styles.link, { color: theme.accent }]}>Ver foto adjunta</Text>
                    </Pressable>
                  ) : null}
                </GlassCard>
              ))
            )}
          </View>
        ) : null}

        {tab === 'calendarios' ? (
          <View style={styles.section}>
            {schedules.length === 0 ? (
              <GlassCard>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin calendarios publicados.</Text>
              </GlassCard>
            ) : (
              schedules.map((schedule) => (
                <GlassCard key={schedule.id} style={styles.mt}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{schedule.title}</Text>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    {schedule.amenity?.name ?? 'Áreas comunes'}
                    {schedule.period_start ? ` · ${schedule.period_start}` : ''}
                  </Text>
                  {schedule.description ? (
                    <Text style={[styles.body, { color: theme.textMuted }]}>{schedule.description}</Text>
                  ) : null}
                  <Pressable onPress={() => void openFile(schedule.file_url)}>
                    <Text style={[styles.link, { color: theme.accent }]}>Ver calendario</Text>
                  </Pressable>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}

        {tab === 'evidencia' ? (
          <View style={styles.section}>
            {workLogs.length === 0 ? (
              <GlassCard>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>Sin evidencia de trabajos aún.</Text>
              </GlassCard>
            ) : (
              workLogs.map((log) => (
                <GlassCard key={log.id} style={styles.mt}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{log.title}</Text>
                  <Text style={[styles.meta, { color: theme.textSubtle }]}>
                    {log.amenity?.name ?? 'General'} · {log.work_date}
                  </Text>
                  {log.description ? (
                    <Text style={[styles.body, { color: theme.textMuted }]}>{log.description}</Text>
                  ) : null}
                  <View style={styles.links}>
                    {log.photo_url ? (
                      <Pressable onPress={() => void openFile(log.photo_url!)}>
                        <Text style={[styles.link, { color: theme.accent }]}>Ver foto</Text>
                      </Pressable>
                    ) : null}
                    {log.file_url ? (
                      <Pressable onPress={() => void openFile(log.file_url!)}>
                        <Text style={[styles.link, { color: theme.accent }]}>Ver documento</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalDismissArea} onPress={Keyboard.dismiss} />
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.textSubtle }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo reporte</Text>
                  <GlassInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="¿Qué necesita reparación?"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <GlassInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe el desperfecto"
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                    style={styles.textArea}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                    {MAINTENANCE_TICKET_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setCategory(cat)}
                        style={[
                          styles.chip,
                          {
                            borderColor: category === cat ? theme.accent : theme.border,
                            backgroundColor: category === cat ? `${theme.accent}22` : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: category === cat ? theme.accent : theme.textMuted, fontSize: 12 }}>
                          {ticketCategoryLabel(cat)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <PrimaryButton
                    label={photo ? 'Cambiar foto' : 'Adjuntar foto (opcional)'}
                    variant="secondary"
                    onPress={() => void pickPhoto()}
                  />
                  {photo?.name ? (
                    <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 8 }}>{photo.name}</Text>
                  ) : null}
                  <View style={styles.modalActions}>
                    <View style={styles.modalActionBtn}>
                      <PrimaryButton label="Cancelar" variant="secondary" onPress={() => setSheetOpen(false)} />
                    </View>
                    <View style={styles.modalActionBtn}>
                      <PrimaryButton
                        label="Enviar reporte"
                        loading={submitting}
                        onPress={() => void handleCreateTicket()}
                      />
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  section: { marginTop: 16 },
  mt: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  note: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  link: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  links: { flexDirection: 'row', gap: 16 },
  error: { marginTop: 12, fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalDismissArea: { flex: 1 },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12, opacity: 0.35 },
  modalScroll: { paddingBottom: 8, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  chips: { marginVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalActionBtn: { flex: 1 },
});
