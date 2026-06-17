import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function CommunityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Comunidad</Text>

      <SectionCard
        title="Feed"
        description="Publicaciones, encuestas, avisos y reacciones de vecinos y administración."
      />
      <SectionCard
        title="Chat"
        description="Canal general y chats por torre o cluster."
      />
      <SectionCard
        title="Documentos"
        description="Minutas, reglamentos, estados de cuenta y archivos PDF."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
});
