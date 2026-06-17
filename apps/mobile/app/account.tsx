import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatResidentProfileLabel } from '@veka/shared';

import { AvatarUploader } from '@/components/AvatarUploader';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
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
  const { profile, refresh } = useProfile();

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Residente';

  const initials = displayName.slice(0, 2).toUpperCase();
  const occupancyLabel = formatResidentProfileLabel(primary?.unit_relationship ?? null);

  return (
    <ScreenBackground>
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
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
        </View>

        <SectionLabel title="Mi unidad" />
        <GlassCard>
          <Row label="Condominio" value={primary?.condominium?.name ?? 'Sin asignar'} theme={theme} />
          <Row label="Unidad" value={primary?.unit?.identifier ?? 'Sin asignar'} theme={theme} />
          <Row label="Perfil" value={occupancyLabel ?? 'Residente'} theme={theme} />
          <Row label="Rol en el condominio" value={primary?.role ?? '—'} theme={theme} last />
        </GlassCard>

        <SectionLabel title="Apariencia" />
        <GlassCard>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Por defecto usamos tema claro. Elige «Sistema» solo si quieres seguir la preferencia del navegador o del
            dispositivo.
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
      </View>
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
  container: { flex: 1, paddingHorizontal: 20, gap: 8 },
  profile: { alignItems: 'center', gap: 6, marginBottom: 12 },
  name: { fontSize: 24, marginTop: 8 },
  row: { paddingVertical: 14 },
  rowLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
});
