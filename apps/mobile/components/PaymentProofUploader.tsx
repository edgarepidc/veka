import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatCurrency } from '@veka/shared';
import { supabase } from '@/lib/supabase';

interface PaymentProofUploaderProps {
  chargeId: string;
  installmentId?: string;
  condominiumId: string;
  unitId: string;
  amount: number;
  maxAmount: number;
  onUploaded: () => void;
}

export function PaymentProofUploader({
  chargeId,
  installmentId,
  condominiumId,
  unitId,
  amount,
  maxAmount,
  onUploaded,
}: PaymentProofUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const uploadProof = useCallback(async () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Indica un monto mayor a cero.');
      return;
    }
    if (amount > maxAmount + 0.01) {
      Alert.alert('Monto inválido', `El abono no puede exceder ${formatCurrency(maxAmount)}.`);
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.name?.split('.').pop() ?? 'jpg';
      const path = `${condominiumId}/${unitId}/${chargeId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, blob, { contentType: asset.mimeType ?? 'application/octet-stream', upsert: false });

      if (uploadError) throw uploadError;

      const { error: paymentError } = await supabase.from('payments').insert({
        charge_id: chargeId,
        condominium_id: condominiumId,
        unit_id: unitId,
        amount,
        proof_url: path,
        payment_method: 'transfer',
        paid_at: new Date().toISOString(),
        ...(installmentId ? { payment_plan_installment_id: installmentId } : {}),
      });

      if (paymentError) throw paymentError;

      Alert.alert(
        'Comprobante enviado',
        amount < maxAmount - 0.01
          ? `Abono de ${formatCurrency(amount)} en revisión.`
          : 'La administración revisará tu pago pronto.',
      );
      onUploaded();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir el comprobante');
    } finally {
      setUploading(false);
    }
  }, [amount, chargeId, condominiumId, maxAmount, onUploaded, unitId]);

  return (
    <PrimaryButton label="Subir comprobante" loading={uploading} onPress={() => void uploadProof()} />
  );
}
