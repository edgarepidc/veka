import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatCurrency } from '@veka/shared';
import { pickImageFromLibrary } from '@/lib/pick-image';
import { readUriAsArrayBuffer } from '@/lib/storage-upload';
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

    const picked = await pickImageFromLibrary();
    if (!picked) return;

    setUploading(true);

    try {
      const bytes = await readUriAsArrayBuffer(picked.uri);
      const ext = picked.name.split('.').pop() ?? 'jpg';
      const path = `${condominiumId}/${unitId}/${chargeId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, bytes, { contentType: picked.mimeType, upsert: false });

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
