import { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';

function viewerSource(url: string) {
  if (Platform.OS === 'ios') {
    return { uri: url };
  }

  return {
    uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`,
  };
}

export default function DocumentViewerScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string | string[]; title?: string | string[] }>();
  const url = Array.isArray(params.url) ? params.url[0] : params.url;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;

  const source = useMemo(() => (url ? viewerSource(url) : null), [url]);

  if (!url || !source) {
    return (
      <ScreenBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
          <Text style={{ color: theme.text }}>No se pudo abrir el documento.</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Volver</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.glassBorder }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '700' }}>‹ Volver</Text>
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {title ?? 'Documento'}
        </Text>
      </View>

      <WebView
        source={source}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
        allowsInlineMediaPlayback
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  backBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
