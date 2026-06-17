import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function DashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View>
        <Text style={[styles.greeting, { color: colors.muted }]}>Bienvenido a</Text>
        <Text style={[styles.title, { color: colors.primary }]}>Veka</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Resumen de tu condominio
        </Text>
      </View>

      <SectionCard
        title="Cuota de mantenimiento"
        description="Próximo vencimiento: 1 de julio · $3,500 MXN"
        badge="Por vencer"
        badgeTone="warning"
      />

      <SectionCard
        title="Reserva confirmada"
        description="Alberca · Sábado 10:00 - 11:00"
        badge="Activa"
        badgeTone="success"
      />

      <SectionCard
        title="Aviso de administración"
        description="Mantenimiento de elevadores programado para el 20 de junio."
      />

      <SectionCard
        title="Paquete en recepción"
        description="Tienes un paquete pendiente de recoger en caseta."
        badge="Nuevo"
        badgeTone="danger"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  greeting: {
    fontSize: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
});
