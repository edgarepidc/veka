import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { supabase } from '@/lib/supabase';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

interface OnlinePaymentButtonProps {
  chargeId: string;
  disabled?: boolean;
  onStarted?: () => void;
}

export function OnlinePaymentButton({ chargeId, disabled, onStarted }: OnlinePaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(async () => {
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
        body: JSON.stringify({ chargeId }),
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
  }, [chargeId, onStarted]);

  return (
    <PrimaryButton
      label="Pagar en línea"
      loading={loading}
      disabled={disabled}
      onPress={() => void startCheckout()}
    />
  );
}
