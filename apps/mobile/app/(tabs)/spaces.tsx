import { ScrollView, StyleSheet, Text } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function SpacesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Espacios comunes</Text>

      <SectionCard
        title="Alberca"
        description="Reserva por hora · Máx. 1 vez al día · 8 al mes"
        badge="Disponible"
        badgeTone="success"
      />
      <SectionCard
        title="Gimnasio"
        description="Reserva por hora · Máx. 2 veces al día"
      />
      <SectionCard
        title="Salón de eventos"
        description="Reserva por bloques de 4 horas · Máx. 2 al mes"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
});
