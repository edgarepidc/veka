import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
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
  MAINTENANCE_PERIOD_LABELS,
  STAFF_ROLE_LABELS,
  groupEvidenceByDate,
  recurrenceLabel,
  type MaintenancePeriodFilter,
} from '@veka/shared';
import type { MembershipRole } from '@veka/shared';

import { Avatar, ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { KeyboardFormSheet, keyboardFormSheetStyles } from '@/components/ui/KeyboardFormSheet';
import { GradientActionButton } from '@/components/ui/GradientActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { FilterBar } from '@/components/ui/TabStrip';
import { ImageCarousel } from '@/components/ui/ImageCarousel';
import { Tag } from '@/components/ui/Tag';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { pickImagesFromLibrary } from '@/lib/pick-image';
import { useAuth } from '@/providers/AuthProvider';
import { routineCardVariant } from '@/lib/card-accent';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type StaffSheet = 'evidence' | 'create' | 'edit' | null;

export default function StaffMaintenanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { primary, loading: membershipLoading } = useMembership();
  const {
    routines,
    amenities,
    routineGroups,
    loading,
    refreshing,
    actionError,
    refresh,
    uploadEvidence,
    createOnDemandRoutine,
    updateOnDemandRoutine,
  } = useMaintenance(primary, 'staff');

  const [periodFilter, setPeriodFilter] = useState<MaintenancePeriodFilter>('month');
  const [activeSheet, setActiveSheet] = useState<StaffSheet>(null);
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const [evidenceDate, setEvidenceDate] = useState(todayIsoDate());
  const [photos, setPhotos] = useState<{ uri: string; mimeType?: string; name?: string }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amenityId, setAmenityId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Personal';
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel = STAFF_ROLE_LABELS[(primary?.role ?? 'staff') as MembershipRole] ?? 'Personal';

  function closeSheet() {
    setActiveSheet(null);
    setSelectedRoutineId('');
    setEvidenceDate(todayIsoDate());
    setPhotos([]);
    setTitle('');
    setDescription('');
    setAmenityId(null);
  }

  function openEvidenceSheet(routineId?: string) {
    setSelectedRoutineId(routineId ?? '');
    setEvidenceDate(todayIsoDate());
    setPhotos([]);
    setActiveSheet('evidence');
  }

  function openCreateSheet() {
    setTitle('');
    setDescription('');
    setAmenityId(null);
    setEvidenceDate(todayIsoDate());
    setPhotos([]);
    setActiveSheet('create');
  }

  function openEditSheet(routineId: string, routineTitle: string, routineDescription: string | null) {
    setSelectedRoutineId(routineId);
    setTitle(routineTitle);
    setDescription(routineDescription ?? '');
    setActiveSheet('edit');
  }

  function canEditRoutine(createdBy: string | null): boolean {
    return Boolean(user?.id && createdBy === user.id);
  }

  async function handlePickPhotos() {
    const picked = await pickImagesFromLibrary();
    if (picked.length === 0) return;
    setPhotos((prev) => [
      ...prev,
      ...picked.map((item) => ({ uri: item.uri, mimeType: item.mimeType, name: item.name })),
    ]);
  }

  async function handleUploadEvidence() {
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await uploadEvidence({
      routineId: selectedRoutineId,
      evidenceDate: evidenceDate.trim(),
      photos,
    });
    setSubmitting(false);
    if (!result.error) closeSheet();
  }

  async function handleCreateOnDemand() {
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await createOnDemandRoutine({
      title,
      description,
      amenityId,
      evidenceDate: evidenceDate.trim(),
      photos,
    });
    setSubmitting(false);
    if (!result.error) closeSheet();
  }

  async function handleUpdateOnDemand() {
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await updateOnDemandRoutine({
      routineId: selectedRoutineId,
      title,
      description,
    });
    setSubmitting(false);
    if (!result.error) closeSheet();
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
            Tu cuenta no tiene un condominio asignado. Pide al administrador que te invite como personal de
            mantenimiento.
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={styles.headerWrap}>
            <ScreenHeader
              title="Mantenimiento"
              highlight="mensual"
              subtitle={`${primary.condominium?.name ?? 'Condominio'} · ${roleLabel}`}
            />
          </View>
          <Pressable onPress={() => router.push('/account')} style={styles.avatarBtn}>
            <Avatar initials={initials} color={theme.accent} size={40} />
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <GradientActionButton
              label="Nuevo a demanda"
              icon="add-circle-outline"
              variant="purple"
              onPress={openCreateSheet}
            />
          </View>
          <View style={styles.buttonHalf}>
            <PrimaryButton label="Registrar evidencia" variant="secondary" onPress={() => openEvidenceSheet()} />
          </View>
        </View>

        {actionError ? <Text style={[styles.error, { color: theme.danger }]}>{actionError}</Text> : null}

        <View style={styles.section}>
          <FilterBar
            items={(Object.keys(MAINTENANCE_PERIOD_LABELS) as MaintenancePeriodFilter[]).map((key) => ({
              key,
              label: MAINTENANCE_PERIOD_LABELS[key],
            }))}
            active={periodFilter}
            onChange={(key) => setPeriodFilter(key as MaintenancePeriodFilter)}
          />
        </View>

        {routines.length === 0 ? (
          <GlassCard variant="muted" style={styles.mt}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
              Sin actividades todavía. Usa «Nuevo a demanda» para registrar un trabajo fuera del calendario.
            </Text>
          </GlassCard>
        ) : (
          routineGroups.map((group) =>
            group.items.length === 0 ? null : (
              <View key={group.label} style={styles.mt}>
                <Text style={[styles.dayHeading, { color: theme.accent }]}>{group.label}</Text>
                {group.items.map((routine) => {
                  const evidenceGroups = groupEvidenceByDate(routine.evidence, periodFilter);
                  const editable = canEditRoutine(routine.created_by);
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
                      <View style={styles.inlineActions}>
                        {editable ? (
                          <Pressable
                            onPress={() => openEditSheet(routine.id, routine.title, routine.description)}
                            style={styles.inlineAction}
                          >
                            <Text style={[styles.link, { color: theme.accent }]}>Editar información</Text>
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => openEvidenceSheet(routine.id)} style={styles.inlineAction}>
                          <Text style={[styles.link, { color: theme.accent }]}>Subir evidencia</Text>
                        </Pressable>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            ),
          )
        )}
      </ScrollView>

      <KeyboardFormSheet
        visible={activeSheet === 'evidence'}
        onClose={closeSheet}
        title="Registrar evidencia"
      >
        <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>Actividad</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {routines.map((routine) => (
            <Pressable
              key={routine.id}
              onPress={() => setSelectedRoutineId(routine.id)}
              style={[
                styles.chip,
                {
                  borderColor: selectedRoutineId === routine.id ? theme.accent : theme.border,
                  backgroundColor: selectedRoutineId === routine.id ? `${theme.accent}22` : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: selectedRoutineId === routine.id ? theme.accent : theme.textMuted,
                  fontSize: 12,
                }}
              >
                {routine.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <GlassInput
          value={evidenceDate}
          onChangeText={setEvidenceDate}
          placeholder="Fecha (AAAA-MM-DD)"
          keyboardType="numbers-and-punctuation"
        />
        <PrimaryButton
          label={photos.length > 0 ? 'Agregar más fotos' : 'Seleccionar fotos'}
          variant="secondary"
          onPress={() => void handlePickPhotos()}
        />
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((photo, index) => (
              <Image key={`${photo.uri}-${index}`} source={{ uri: photo.uri }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={closeSheet} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Guardar evidencia"
              variant="success"
              loading={submitting}
              onPress={() => void handleUploadEvidence()}
            />
          </View>
        </View>
      </KeyboardFormSheet>

      <KeyboardFormSheet
        visible={activeSheet === 'create'}
        onClose={closeSheet}
        title="Nuevo trabajo a demanda"
      >
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Registra un trabajo fuera del calendario programado. Aparecerá en la sección «A demanda».
        </Text>
        <GlassInput
          value={title}
          onChangeText={setTitle}
          placeholder="¿Qué trabajo realizaste?"
          returnKeyType="next"
        />
        <GlassInput
          value={description}
          onChangeText={setDescription}
          placeholder="Detalles del trabajo (opcional)"
          multiline
          style={keyboardFormSheetStyles.textArea}
        />
        <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>Área (opcional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Pressable
            onPress={() => setAmenityId(null)}
            style={[
              styles.chip,
              {
                borderColor: amenityId === null ? theme.accent : theme.border,
                backgroundColor: amenityId === null ? `${theme.accent}22` : 'transparent',
              },
            ]}
          >
            <Text style={{ color: amenityId === null ? theme.accent : theme.textMuted, fontSize: 12 }}>
              Áreas comunes
            </Text>
          </Pressable>
          {amenities.map((amenity) => (
            <Pressable
              key={amenity.id}
              onPress={() => setAmenityId(amenity.id)}
              style={[
                styles.chip,
                {
                  borderColor: amenityId === amenity.id ? theme.accent : theme.border,
                  backgroundColor: amenityId === amenity.id ? `${theme.accent}22` : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: amenityId === amenity.id ? theme.accent : theme.textMuted,
                  fontSize: 12,
                }}
              >
                {amenity.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <GlassInput
          value={evidenceDate}
          onChangeText={setEvidenceDate}
          placeholder="Fecha del trabajo (AAAA-MM-DD)"
          keyboardType="numbers-and-punctuation"
        />
        <PrimaryButton
          label={photos.length > 0 ? 'Agregar más fotos' : 'Adjuntar fotos (opcional)'}
          variant="secondary"
          onPress={() => void handlePickPhotos()}
        />
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((photo, index) => (
              <Image key={`${photo.uri}-${index}`} source={{ uri: photo.uri }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={closeSheet} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Publicar tarjeta"
              variant="success"
              loading={submitting}
              onPress={() => void handleCreateOnDemand()}
            />
          </View>
        </View>
      </KeyboardFormSheet>

      <KeyboardFormSheet visible={activeSheet === 'edit'} onClose={closeSheet} title="Editar trabajo a demanda">
        <GlassInput value={title} onChangeText={setTitle} placeholder="Título del trabajo" />
        <GlassInput
          value={description}
          onChangeText={setDescription}
          placeholder="Detalles del trabajo"
          multiline
          style={keyboardFormSheetStyles.textArea}
        />
        <View style={keyboardFormSheetStyles.actions}>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton label="Cancelar" variant="muted" onPress={closeSheet} />
          </View>
          <View style={keyboardFormSheetStyles.actionBtn}>
            <PrimaryButton
              label="Guardar cambios"
              variant="success"
              loading={submitting}
              onPress={() => void handleUpdateOnDemand()}
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
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  buttonHalf: { flex: 1 },
  section: { marginTop: 16 },
  mt: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  meta: { fontSize: 12, marginTop: 4 },
  body: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  error: { marginTop: 12, fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  dayHeading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  routineCard: { marginBottom: 10 },
  evidenceBlock: { marginTop: 12 },
  evidenceLabel: { fontSize: 12, fontWeight: '700' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  inlineAction: {},
  link: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  chips: { marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  photoRow: { marginTop: 8 },
  thumb: { width: 72, height: 72, borderRadius: 10, marginRight: 8 },
});
