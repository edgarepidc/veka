import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatCurrency } from '@veka/shared';
import { supabase } from '@/lib/supabase';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

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
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(async () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Indica un monto mayor a cero.');
      return;
    }
    if (amount > maxAmount + 0.01) {
      Alert.alert('Monto inválido', `El abono no puede exceder ${formatCurrency(maxAmount)}.`);
      return;
    }

    setLoading(true);
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
        body: JSON.stringify(
          installmentId ? { installmentId, chargeId, amount } : { chargeId, amount },
        ),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'No se pudo iniciar el pago en línea');
      }

      onStarted?.();
      await WebBrowser.openBrowserAsync(payload.url);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo abrir la pasarela');
    } finally {
      setLoading(false);
    }
  }, [amount, chargeId, installmentId, maxAmount, onStarted]);

  const isPartial = amount < maxAmount - 0.01;
  const label = isPartial ? `Pagar abono ${formatCurrency(amount)}` : 'Pagar en línea';

  return (
    <PrimaryButton
      label={label}
      loading={loading}
      disabled={disabled}
      onPress={() => void startCheckout()}
    />
  );
}
