import { encodeVisitQrPayload, formatDateKey, formatVisitDateRangeLabel, formatVisitVehicle, visitTypeLabelEs } from '@veka/shared';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';

import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/hooks/useTheme';
import { saveViewToGallery, shareViewImage } from '@/lib/save-view-image';
import { visitAccentTone } from '@/lib/card-accent';
import type { VisitRow } from '@/hooks/useSecurity';

interface VisitQrPassProps {
  visit: VisitRow;
  condominiumName: string;
  unitIdentifier: string;
}

function formatPassValidity(from: string, until: string): string {
  const startKey = formatDateKey(new Date(from));
  const endKey = formatDateKey(new Date(until));
  return formatVisitDateRangeLabel(startKey, endKey);
}

export function VisitQrPass({ visit, condominiumName, unitIdentifier }: VisitQrPassProps) {
  const theme = useTheme();
  const passRef = useRef<ViewShot>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  const qrValue = encodeVisitQrPayload(visit.qr_token);

  async function handleSave() {
    setBusy('save');
    try {
      await saveViewToGallery(passRef);
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy('share');
    try {
      await shareViewImage(passRef);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <ViewShot ref={passRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.exportCard}>
          <Text style={styles.exportBrand}>Veka · Pase de acceso</Text>
          <Text style={styles.exportCondo}>{condominiumName}</Text>
          <Text style={styles.exportUnit}>Unidad {unitIdentifier}</Text>

          <View style={styles.exportDivider} />

          <Text style={styles.exportVisitor}>{visit.visitor_name}</Text>
          <Text style={styles.exportMeta}>{visitTypeLabelEs(visit.visit_type)}</Text>
          {visit.visitor_phone ? <Text style={styles.exportMeta}>{visit.visitor_phone}</Text> : null}
          {visit.visit_type === 'rental' && visit.stay_days ? (
            <Text style={styles.exportMeta}>Estancia: {visit.stay_days} día(s)</Text>
          ) : null}
          {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model) ? (
            <Text style={styles.exportMeta}>
              Vehículo: {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model)}
            </Text>
          ) : null}
          {visit.notes ? <Text style={styles.exportMeta}>{visit.notes}</Text> : null}

          <Text style={styles.exportValidity}>
            Válido: {formatPassValidity(visit.valid_from, visit.valid_until)}
          </Text>

          <View style={styles.qrFrame}>
            <QRCode value={qrValue} size={196} backgroundColor="#FFFFFF" color="#0F172A" />
          </View>

          <Text style={styles.exportHint}>Presenta este código en caseta</Text>
          <Text style={styles.exportToken}>Ref. {visit.qr_token.slice(0, 8).toUpperCase()}</Text>
        </View>
      </ViewShot>

      <GlassCard variant="accent" accent={visitAccentTone(visit)} style={styles.previewMeta}>
        <View style={styles.previewTop}>
          <Text style={[styles.previewName, { color: theme.text, fontFamily: theme.serifFamily }]}>
            {visit.visitor_name}
          </Text>
          <Tag label={visitTypeLabelEs(visit.visit_type)} tone="blue" />
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
          Válido: {formatPassValidity(visit.valid_from, visit.valid_until)}
        </Text>
      </GlassCard>

      <PrimaryButton
        label={busy === 'save' ? 'Guardando…' : 'Guardar pase en fotos'}
        variant="success"
        onPress={() => void handleSave()}
        disabled={busy !== null}
      />
      <PrimaryButton
        label={busy === 'share' ? 'Preparando…' : 'Compartir pase'}
        variant="secondary"
        onPress={() => void handleShare()}
        disabled={busy !== null}
        style={styles.shareBtn}
      />
      {busy ? <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  exportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: 'center',
  },
  exportBrand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#2563EB',
  },
  exportCondo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
    textAlign: 'center',
  },
  exportUnit: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  exportDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  exportVisitor: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  exportMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  exportValidity: {
    fontSize: 12,
    color: '#475569',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  qrFrame: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exportHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 14,
    textAlign: 'center',
  },
  exportToken: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    letterSpacing: 1,
  },
  previewMeta: { marginTop: 14, marginBottom: 14, alignItems: 'center' },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  previewName: { fontSize: 18, fontWeight: '700' },
  shareBtn: { marginTop: 8 },
});
