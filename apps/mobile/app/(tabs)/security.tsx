import { ScrollView, StyleSheet, Text } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function SecurityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Seguridad</Text>

      <SectionCard
        title="Visitas con QR"
        description="Pre-autoriza visitas, servicios o rentas. El guardia escanea y recibes notificación al ingreso."
      />
      <SectionCard
        title="Paquetería"
        description="Registro en recepción, notificación push y firma de recibido."
        badge="1 pendiente"
        badgeTone="warning"
      />
      <SectionCard
        title="Historial de accesos"
        description="Consulta quién ingresó, cuándo salió y el tipo de visita."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
});
