import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatResidentProfileLabel, isGuardFieldRole, isMaintenanceFieldRole, STAFF_ROLE_LABELS } from '@veka/shared';
import type { MembershipRole } from '@veka/shared';

import { AvatarUploader } from '@/components/AvatarUploader';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useMembership } from '@/hooks/useMembership';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/providers/AuthProvider';

export default function AccountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { primary } = useMembership();
  const { profile, refresh, updatePhone, updateShowPhoneInDirectory } = useProfile();
  const [phoneInput, setPhoneInput] = useState('');
  const [showPhoneInDirectory, setShowPhoneInDirectory] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Residente';

  const initials = displayName.slice(0, 2).toUpperCase();
  const occupancyLabel = isMaintenanceFieldRole(primary?.role ?? '')
    ? STAFF_ROLE_LABELS[(primary?.role ?? 'staff') as MembershipRole]
    : isGuardFieldRole(primary?.role ?? '')
      ? STAFF_ROLE_LABELS[(primary?.role ?? 'guard') as MembershipRole]
      : formatResidentProfileLabel(primary?.unit_relationship ?? null);
  const clusterName = primary?.unit?.cluster?.name ?? 'Sin asignar';

  useEffect(() => {
    setPhoneInput(profile?.phone ?? '');
    setShowPhoneInDirectory(Boolean(profile?.show_phone_in_directory));
  }, [profile?.phone, profile?.show_phone_in_directory]);

  async function handleSavePhone() {
    Keyboard.dismiss();
    setSavingPhone(true);
    const result = await updatePhone(phoneInput, showPhoneInDirectory);
    setSavingPhone(false);

    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }

    Alert.alert('Teléfono actualizado', 'Tu número quedó guardado en tu perfil.');
  }

  async function handleTogglePhoneVisibility() {
    const next = !showPhoneInDirectory;
    setShowPhoneInDirectory(next);
    setSavingVisibility(true);
    const result = await updateShowPhoneInDirectory(next);
    setSavingVisibility(false);

    if (result.error) {
      setShowPhoneInDirectory(!next);
      Alert.alert('Error', result.error);
    }
  }

  return (
    <ScreenBackground>
      <Stack.Screen
        options={{
          title: 'Mi cuenta',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.accent,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel title="Información personal" />
        <GlassCard>
          <View style={styles.profile}>
            {user ? (
              <AvatarUploader
                userId={user.id}
                avatarPath={profile?.avatar_url ?? null}
                initials={initials}
                onUploaded={() => void refresh()}
              />
            ) : null}
            <Text style={[styles.name, { color: theme.text, fontFamily: theme.serifFamily }]}>{displayName}</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>{user?.email}</Text>
            <Text style={[styles.role, { color: theme.textSubtle }]}>{occupancyLabel ?? 'Residente'}</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.phoneCard}>
          <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>Teléfono</Text>
          <GlassInput
            placeholder="55 1234 5678"
            value={phoneInput}
            onChangeText={setPhoneInput}
            keyboardType="phone-pad"
            style={styles.phoneInput}
          />
          <Pressable
            onPress={() => void handleTogglePhoneVisibility()}
            disabled={savingVisibility}
            style={styles.visibilityRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: showPhoneInDirectory }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: theme.border,
                  backgroundColor: showPhoneInDirectory ? theme.accent : 'transparent',
                },
              ]}
            >
              {showPhoneInDirectory ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <View style={styles.visibilityCopy}>
              <Text style={[styles.visibilityTitle, { color: theme.text }]}>
                Mostrar mi teléfono en el directorio
              </Text>
              <Text style={[styles.visibilityHint, { color: theme.textMuted }]}>
                Si lo activas, tu número puede verse en Comunidad → Personal (comité y equipo).
              </Text>
            </View>
          </Pressable>
          <PrimaryButton
            label="Guardar teléfono"
            variant="success"
            loading={savingPhone}
            onPress={() => void handleSavePhone()}
          />
        </GlassCard>

        <SectionLabel title="Mi condominio" />
        <GlassCard>
          <Row label="Condominio" value={primary?.condominium?.name ?? 'Sin asignar'} theme={theme} />
          <Row label="Torre / cluster" value={clusterName} theme={theme} />
          <Row label="Unidad" value={primary?.unit?.identifier ?? 'Sin asignar'} theme={theme} last />
        </GlassCard>

        <SectionLabel title="Apariencia" />
        <GlassCard>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Por defecto usamos tema claro. Elige «Sistema» solo si quieres seguir la preferencia del dispositivo.
          </Text>
          <AppearancePicker />
        </GlassCard>

        <SectionLabel title="Sesión" />
        <PrimaryButton
          label="Cerrar sesión"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

function Row({
  label,
  value,
  theme,
  last,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <Text style={[styles.rowLabel, { color: theme.textSubtle }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  profile: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  name: { fontSize: 22, marginTop: 4 },
  role: { fontSize: 12, marginTop: 2 },
  phoneCard: { marginTop: 0 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  phoneInput: { marginBottom: 12 },
  visibilityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { fontSize: 14, fontWeight: '600' },
  visibilityHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  row: { paddingVertical: 14 },
  rowLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
});
