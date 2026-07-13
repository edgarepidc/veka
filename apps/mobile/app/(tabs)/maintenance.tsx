import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAINTENANCE_PERIOD_LABELS,
  MAINTENANCE_TICKET_CATEGORIES,
  groupEvidenceByDate,
  matchesClusterResourceScope,
  recurrenceLabel,
  ticketCategoryLabel,
  ticketStatusLabel,
  type MaintenancePeriodFilter,
} from '@veka/shared';
import type { MaintenanceTicketCategory } from '@veka/shared';

import { ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { KeyboardFormSheet, keyboardFormSheetStyles } from '@/components/ui/KeyboardFormSheet';
import { GradientActionButton } from '@/components/ui/GradientActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { ScopeFilterBar } from '@/components/ui/ScopeFilterBar';
import { FilterBar, TabStrip } from '@/components/ui/TabStrip';
import { ImageCarousel } from '@/components/ui/ImageCarousel';
import { Tag } from '@/components/ui/Tag';
import { useCondominiumClusters } from '@/hooks/useCondominiumClusters';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';
import { ticketAccentTone, ticketTagTone, routineCardVariant } from '@/lib/card-accent';
import { pickImageFromLibrary } from '@/lib/pick-image';

export default function MaintenanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();
  const { scopeFilterItems, hasClusters, loading: clustersLoading } = useCondominiumClusters(primary);
  const { tickets, routines, routineGroups, loading, refreshing, actionError, refresh, createTicket, getSignedUrl } =
    useMaintenance(primary);

  const params = useLocalSearchParams<{ ticketId?: string | string[] }>();
  const ticketIdParam = Array.isArray(params.ticketId) ? params.ticketId[0] : params.ticketId;

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const ticketRefs = useRef<Record<string, View | null>>({});

  const [tab, setTab] = useState('tickets');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<MaintenancePeriodFilter>('month');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);
  const [scrollToTicketId, setScrollToTicketId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaintenanceTicketCategory>('unit');
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string; name?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const myClusterId = primary?.unit?.cluster?.id ?? null;

  const visibleTickets = useMemo(() => {
    if (scopeFilter === 'all') return tickets;
    // Resident tickets belong to their unit; keep them when viewing their tower or Todo.
    if (!myClusterId) return tickets;
    return myClusterId === scopeFilter ? tickets : [];
  }, [myClusterId, scopeFilter, tickets]);

  const visibleRoutines = useMemo(
    () =>
      routines.filter((routine) =>
        matchesClusterResourceScope(routine.amenity?.cluster_id ?? null, scopeFilter),
      ),
    [routines, scopeFilter],
  );

  const visibleRoutineGroups = useMemo(
    () =>
      routineGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((routine) =>
            matchesClusterResourceScope(routine.amenity?.cluster_id ?? null, scopeFilter),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [routineGroups, scopeFilter],
  );

  useEffect(() => {
    if (ticketIdParam) setScrollToTicketId(ticketIdParam);
  }, [ticketIdParam]);

  useEffect(() => {
    if (!scrollToTicketId || loading) return;
    if (!tickets.some((item) => item.id === scrollToTicketId)) return;

    setTab('tickets');

    const timer = setTimeout(() => {
      const ticketView = ticketRefs.current[scrollToTicketId];
      const content = contentRef.current;
      if (!ticketView || !content) return;

      ticketView.measureLayout(
        content,
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
          setHighlightTicketId(scrollToTicketId);
          setScrollToTicketId(null);
          setTimeout(() => setHighlightTicketId(null), 2500);
        },
        () => undefined,
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [scrollToTicketId, loading, tickets]);

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

  if (membershipLoading || clustersLoading || loading) {
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
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View ref={contentRef} collapsable={false}>
        <ScreenHeader
          title="Mantenimiento"
          highlight="y reportes"
          subtitle={`Unidad ${primary.unit?.identifier}`}
        />

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'tickets', label: 'Mis tickets' },
              { key: 'mensual', label: 'Mantenimiento mensual' },
            ]}
            active={tab}
            onChange={setTab}
          />
          {hasClusters ? (
            <ScopeFilterBar items={scopeFilterItems} active={scopeFilter} onChange={setScopeFilter} />
          ) : null}
        </View>

        {actionError ? (
          <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text>
        ) : null}

        {tab === 'tickets' ? (
          <View style={styles.section}>
            <GradientActionButton
              label="Nuevo reporte"
              icon="construct-outline"
              variant="purple"
              onPress={() => setSheetOpen(true)}
              style={styles.createAction}
            />
            {visibleTickets.length === 0 ? (
              <GlassCard variant="muted" style={styles.mt}>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>No tienes tickets en esta vista.</Text>
              </GlassCard>
            ) : (
              visibleTickets.map((ticket) => (
                <View
                  key={ticket.id}
                  ref={(node) => {
                    ticketRefs.current[ticket.id] = node;
                  }}
                  collapsable={false}
                >
                <GlassCard
                  variant="accent"
                  accent={ticketAccentTone(ticket.status)}
                  style={[
                    styles.mt,
                    highlightTicketId === ticket.id
                      ? { borderColor: theme.accent, borderWidth: 2 }
                      : undefined,
                  ]}
                >
                  <View style={styles.row}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{ticket.title}</Text>
                    <Tag label={ticketStatusLabel(ticket.status)} tone={ticketTagTone(ticket.status)} />
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
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'mensual' ? (
          <View style={styles.section}>
            <FilterBar
              items={(Object.keys(MAINTENANCE_PERIOD_LABELS) as MaintenancePeriodFilter[]).map((key) => ({
                key,
                label: MAINTENANCE_PERIOD_LABELS[key],
              }))}
              active={periodFilter}
              onChange={(key) => setPeriodFilter(key as MaintenancePeriodFilter)}
            />
            {visibleRoutines.length === 0 ? (
              <GlassCard variant="muted" style={styles.mt}>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                  Sin actividades en este alcance. El administrador publicará el programa mensual aquí.
                </Text>
              </GlassCard>
            ) : (
              visibleRoutineGroups.map((group) =>
                group.items.length === 0 ? null : (
                  <View key={group.label} style={styles.mt}>
                    <Text style={[styles.dayHeading, { color: theme.accent }]}>{group.label}</Text>
                    {group.items.map((routine) => {
                      const evidenceGroups = groupEvidenceByDate(routine.evidence, periodFilter);
                      return (
                        <GlassCard
                          key={routine.id}
                          style={styles.routineCard}
                          variant={routineCardVariant(evidenceGroups.length > 0)}
                          accent="green"
                        >
                          <View style={styles.row}>
                            <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>{routine.title}</Text>
                            <Tag label={recurrenceLabel(routine.recurrence)} tone="blue" />
                          </View>
                          <Text style={[styles.meta, { color: theme.textSubtle }]}>
                            {routine.amenity?.name ?? 'Áreas comunes'}
                            {routine.monthly_day ? ` · día ${routine.monthly_day} del mes` : ''}
                          </Text>
                          {routine.description ? (
                            <Text style={[styles.body, { color: theme.textMuted }]}>{routine.description}</Text>
                          ) : null}
                          {evidenceGroups.length === 0 ? (
                            <Text style={[styles.meta, { color: theme.textSubtle, marginTop: 8 }]}>
                              Sin evidencia en este periodo.
                            </Text>
                          ) : (
                            evidenceGroups.map((evidenceGroup) => (
                              <View key={evidenceGroup.date} style={styles.evidenceBlock}>
                                <Text style={[styles.evidenceLabel, { color: theme.accent }]}>
                                  {evidenceGroup.label}
                                </Text>
                                <ImageCarousel
                                  images={evidenceGroup.items.map((image) => ({
                                    id: image.id,
                                    url: image.resolved_url,
                                  }))}
                                  onOpen={(url) => void Linking.openURL(url)}
                                />
                              </View>
                            ))
                          )}
                        </GlassCard>
                      );
                    })}
                  </View>
                ),
              )
            )}
          </View>
        ) : null}
        </View>
      </ScrollView>

      <KeyboardFormSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Nuevo reporte">
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
          style={keyboardFormSheetStyles.textArea}
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
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={() => setSheetOpen(false)} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Enviar reporte"
              variant="success"
              loading={submitting}
              onPress={() => void handleCreateTicket()}
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
  section: { marginTop: 16 },
  createAction: { marginBottom: 12 },
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
  chips: { marginVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  dayHeading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  routineCard: { marginBottom: 10 },
  evidenceBlock: { marginTop: 12 },
  evidenceLabel: { fontSize: 12, fontWeight: '700' },
});
