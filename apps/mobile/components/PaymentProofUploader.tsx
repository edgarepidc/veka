import { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { GradientActionButton } from '@/components/ui/GradientActionButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@veka/shared';
import { type PickedImage, pickImageFromLibrary } from '@/lib/pick-image';
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

function validateAmount(amount: number, maxAmount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Indica un monto mayor a cero.';
  }
  if (amount > maxAmount + 0.01) {
    return `El abono no puede exceder ${formatCurrency(maxAmount)}.`;
  }
  return null;
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
  const theme = useTheme();
  const [pendingImage, setPendingImage] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickProof = useCallback(async () => {
    const amountError = validateAmount(amount, maxAmount);
    if (amountError) {
      Alert.alert('Monto inválido', amountError);
      return;
    }

    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setPendingImage(picked);
  }, [amount, maxAmount]);

  const submitProof = useCallback(async () => {
    if (!pendingImage) return;

    const amountError = validateAmount(amount, maxAmount);
    if (amountError) {
      Alert.alert('Monto inválido', amountError);
      return;
    }

    setUploading(true);

    try {
      const bytes = await readUriAsArrayBuffer(pendingImage.uri);
      const ext = pendingImage.name.split('.').pop() ?? 'jpg';
      const path = `${condominiumId}/${unitId}/${chargeId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(path, bytes, { contentType: pendingImage.mimeType, upsert: false });

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

      setPendingImage(null);
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
  }, [amount, chargeId, condominiumId, installmentId, maxAmount, onUploaded, pendingImage, unitId]);

  if (pendingImage) {
    return (
      <View style={styles.previewBlock}>
        <Text style={[styles.previewLabel, { color: theme.textSubtle }]}>Vista previa del comprobante</Text>
        <View style={[styles.thumbnailFrame, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
          <Image source={{ uri: pendingImage.uri }} style={styles.thumbnail} resizeMode="contain" />
        </View>
        <Text style={[styles.amountHint, { color: theme.textMuted }]}>
          Monto a reportar: {formatCurrency(amount)}
        </Text>
        <PrimaryButton
          label="Enviar comprobante"
          loading={uploading}
          onPress={() => void submitProof()}
          style={styles.actionBtn}
        />
        <PrimaryButton
          label="Cambiar imagen"
          variant="secondary"
          disabled={uploading}
          onPress={() => void pickProof()}
          style={styles.actionBtn}
        />
        <PrimaryButton
          label="Cancelar"
          variant="secondary"
          disabled={uploading}
          onPress={() => setPendingImage(null)}
        />
      </View>
    );
  }

  return (
    <GradientActionButton
      label="Adjuntar comprobante"
      icon="document-attach-outline"
      variant="purple"
      onPress={() => void pickProof()}
    />
  );
}

const styles = StyleSheet.create({
  previewBlock: { gap: 0 },
  previewLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  thumbnailFrame: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    marginBottom: 10,
  },
  thumbnail: { width: '100%', height: '100%' },
  amountHint: { fontSize: 13, marginBottom: 12 },
  actionBtn: { marginBottom: 8 },
});
