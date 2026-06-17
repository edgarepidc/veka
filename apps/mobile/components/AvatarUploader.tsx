import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  avatarStoragePath,
  imageExtensionFromMime,
  MAX_IMAGE_BYTES,
  resolveStorageImageUrl,
  STORAGE_BUCKETS,
} from '@veka/shared';

import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export function AvatarUploader({
  userId,
  avatarPath,
  initials,
  onUploaded,
}: {
  userId: string;
  avatarPath: string | null;
  initials: string;
  onUploaded: () => void;
}) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  const imageUri = resolveStorageImageUrl(SUPABASE_URL, avatarPath, STORAGE_BUCKETS.AVATARS);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para cambiar el avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error('La imagen no puede superar 2 MB.');
      }

      const mime = asset.mimeType ?? blob.type ?? 'image/jpeg';
      const ext = imageExtensionFromMime(mime);
      const path = avatarStoragePath(userId, ext);

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.AVATARS).upload(path, blob, {
        upsert: true,
        contentType: mime,
      });

      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            avatar_url: path,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );

      if (profileError) throw profileError;

      onUploaded();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable onPress={() => void pickAndUpload()} disabled={uploading} style={styles.wrapper}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={[styles.avatar, { width: 72, height: 72, borderRadius: 36 }]} />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: `${theme.accent}22`,
            },
          ]}
        >
          <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '700' }}>{initials}</Text>
        </View>
      )}
      <Text style={[styles.hint, { color: theme.accent2 }]}>
        {uploading ? 'Subiendo…' : 'Toca para cambiar foto'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 8 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, fontWeight: '500' },
});
