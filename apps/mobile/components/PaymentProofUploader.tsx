import { useCallback, useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';

interface PaymentProofUploaderProps {
  chargeId: string;
  condominiumId: string;
  unitId: string;
  amount: number;
  onUploaded: () => void;
}

export function PaymentProofUploader({
  chargeId,
  condominiumId,
  unitId,
  amount,
  onUploaded,
}: PaymentProofUploaderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [uploading, setUploading] = useState(false);

  const uploadProof = useCallback(async () => {
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
      });

      if (paymentError) throw paymentError;

      Alert.alert('Comprobante enviado', 'La administración revisará tu pago pronto.');
      onUploaded();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir el comprobante');
    } finally {
      setUploading(false);
    }
  }, [amount, chargeId, condominiumId, onUploaded, unitId]);

  return (
    <Pressable
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={uploadProof}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>Subir comprobante</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
