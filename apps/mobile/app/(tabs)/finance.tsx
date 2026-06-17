import { ScrollView, StyleSheet, Text } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function FinanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Finanzas</Text>

      <SectionCard
        title="Mi cuenta"
        description="Estado de cuenta, próximo pago, subir comprobante y historial de movimientos."
        badge="Al día"
        badgeTone="success"
      />
      <SectionCard
        title="Estado del condominio"
        description="Fondo operativo y de reserva, ingresos y egresos del mes con evidencia adjunta."
      />
      <SectionCard
        title="Morosidad"
        description="Vista agregada: 85% de unidades al día este mes."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
});
