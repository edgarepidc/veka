import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setMessage(null);
    setLoading(true);

    const result =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim());

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'signup') {
      setMessage('Cuenta creada. Si tu email fue invitado, ya tienes acceso a tu unidad.');
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.brand, { color: theme.text, fontFamily: theme.serifFamily }]}>Veka</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            Gestión condominal para{' '}
            <Text style={{ color: theme.accent, fontStyle: 'italic', fontFamily: theme.serifFamily }}>
              residentes
            </Text>
          </Text>

          <GlassCard style={styles.formCard}>
            <Text style={[styles.formTitle, { color: theme.text, fontFamily: theme.serifFamily }]}>
              {mode === 'login' ? 'Bienvenido' : 'Crear cuenta'}
            </Text>

            {mode === 'signup' ? (
              <GlassInput
                placeholder="Nombre completo"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            ) : null}

            <GlassInput
              placeholder="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <GlassInput
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={[styles.feedback, { color: theme.danger }]}>{error}</Text> : null}
            {message ? <Text style={[styles.feedback, { color: theme.accent }]}>{message}</Text> : null}

            <PrimaryButton
              label={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              loading={loading}
              onPress={() => void handleSubmit()}
            />
          </GlassCard>

          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchWrap}>
            <Text style={[styles.switch, { color: theme.accent2 }]}>
              {mode === 'login'
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  brand: { fontSize: 42, lineHeight: 48 },
  tagline: { fontSize: 15, marginBottom: 8 },
  formCard: { marginTop: 8 },
  formTitle: { fontSize: 22, marginBottom: 14 },
  feedback: { fontSize: 13, marginBottom: 8 },
  switchWrap: { alignItems: 'center', marginTop: 8 },
  switch: { fontSize: 14, fontWeight: '500' },
});
