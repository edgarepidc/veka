import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.primary }]}>Veka</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Gestión condominal para residentes
        </Text>

        {mode === 'signup' ? (
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Nombre completo"
            placeholderTextColor={colors.muted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        ) : null}

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Correo electrónico"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Contraseña"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {message ? <Text style={[styles.message, { color: colors.success }]}>{message}</Text> : null}

        <Pressable
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          <Text style={[styles.switch, { color: colors.tint }]}>
            {mode === 'login'
              ? '¿No tienes cuenta? Regístrate'
              : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  brand: { fontSize: 36, fontWeight: '700' },
  subtitle: { fontSize: 15, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switch: { textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { fontSize: 14 },
  message: { fontSize: 14 },
});
