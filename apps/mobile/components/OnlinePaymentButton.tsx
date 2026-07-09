import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { PaymentActionButton } from '@/components/finance/PaymentActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatCurrency } from '@veka/shared';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

type GatewayMethod = 'card' | 'oxxo' | 'spei';

interface OnlinePaymentButtonProps {
  chargeId: string;
  installmentId?: string;
  amount: number;
  maxAmount: number;
  disabled?: boolean;
  onStarted?: () => void;
}

export function OnlinePaymentButton({
  chargeId,
  installmentId,
  amount,
  maxAmount,
  disabled,
  onStarted,
}: OnlinePaymentButtonProps) {
  const theme = useTheme();
  const [loadingMethod, setLoadingMethod] = useState<GatewayMethod | null>(null);

  const startCheckout = useCallback(
    async (paymentMethod: GatewayMethod) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Monto inválido', 'Indica un monto mayor a cero.');
        return;
      }
      if (amount > maxAmount + 0.01) {
        Alert.alert('Monto inválido', `El abono no puede exceder ${formatCurrency(maxAmount)}.`);
        return;
      }

      setLoadingMethod(paymentMethod);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          Alert.alert('Sesión requerida', 'Inicia sesión para pagar en línea.');
          return;
        }

        const response = await fetch(`${ADMIN_URL}/api/payments/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...(installmentId ? { installmentId, chargeId } : { chargeId }),
            amount,
            paymentMethod,
          }),
        });

        const payload = (await response.json()) as {
          url?: string;
          error?: string;
          awaitingPayment?: boolean;
          gatewayReference?: string | null;
        };
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? 'No se pudo iniciar el pago en línea');
        }

        if (payload.awaitingPayment && payload.gatewayReference) {
          Alert.alert(
            'Referencia de pago',
            `Completa tu pago con esta referencia:\n\n${payload.gatewayReference}`,
          );
        }

        onStarted?.();
        await WebBrowser.openBrowserAsync(payload.url);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo abrir la pasarela');
      } finally {
        setLoadingMethod(null);
      }
    },
    [amount, chargeId, installmentId, maxAmount, onStarted],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: theme.textSubtle }]}>PAGO EN LÍNEA</Text>
      <PaymentActionButton
        label="Pagar con tarjeta"
        icon="card-outline"
        variant="blue"
        loading={loadingMethod === 'card'}
        disabled={disabled}
        onPress={() => void startCheckout('card')}
      />
      <View style={styles.altRow}>
        <PrimaryButton
          label="Oxxo"
          variant="secondary"
          loading={loadingMethod === 'oxxo'}
          disabled={disabled}
          style={styles.altButton}
          onPress={() => void startCheckout('oxxo')}
        />
        <PrimaryButton
          label="SPEI"
          variant="secondary"
          loading={loadingMethod === 'spei'}
          disabled={disabled}
          style={styles.altButton}
          onPress={() => void startCheckout('spei')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  altRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  altButton: { flex: 1 },
});
