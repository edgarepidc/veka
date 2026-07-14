import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useTheme } from '@/hooks/useTheme';

export function VisitQrScanner({
  active,
  onScan,
}: {
  active: boolean;
  onScan: (payload: string) => void;
}) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setCameraOpen(false);
      setLocked(false);
      handlingRef.current = false;
    }
  }, [active]);

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      const data = result.data?.trim();
      if (!data || locked || handlingRef.current) return;
      handlingRef.current = true;
      setLocked(true);
      setCameraOpen(false);
      onScan(data);
      handlingRef.current = false;
    },
    [locked, onScan],
  );

  if (!active) return null;

  if (!permission) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
        Preparando permisos de cámara…
      </Text>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.block, styles.denied, { borderColor: theme.danger }]}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 6 }}>
          Cámara bloqueada
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
          Necesitamos la cámara para escanear el pase QR. Actívala en Ajustes del teléfono si ya la denegaste.
        </Text>
        <PrimaryButton label="Permitir cámara" variant="secondary" onPress={() => void requestPermission()} />
      </View>
    );
  }

  if (!cameraOpen) {
    return (
      <View style={styles.block}>
        <PrimaryButton
          label={locked ? 'Escanear otro pase' : 'Abrir cámara'}
          variant="secondary"
          onPress={() => {
            setLocked(false);
            setCameraOpen(true);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={[styles.cameraWrap, { borderColor: theme.border }]}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={locked ? undefined : handleBarcode}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.frame, { borderColor: theme.accent }]} />
          <Text style={[styles.hint, { color: '#fff' }]}>Apunta al QR del pase</Text>
        </View>
      </View>
      <Pressable onPress={() => setCameraOpen(false)} style={styles.closeBtn}>
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Cerrar cámara</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 12 },
  denied: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  cameraWrap: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  frame: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeBtn: { marginTop: 10, alignSelf: 'flex-start' },
});
