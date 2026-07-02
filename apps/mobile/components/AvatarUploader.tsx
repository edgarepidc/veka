import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  avatarStoragePath,
  imageExtensionFromMime,
  MAX_IMAGE_BYTES,
  resolveStorageImageUrl,
  STORAGE_BUCKETS,
} from '@veka/shared';

import { useTheme } from '@/hooks/useTheme';
import { readUriAsArrayBuffer } from '@/lib/storage-upload';
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
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [cacheKey, setCacheKey] = useState(0);

  useEffect(() => {
    setImageFailed(false);
    setLocalPreviewUri(null);
  }, [avatarPath]);

  const remoteUri = useMemo(() => {
    const base = resolveStorageImageUrl(SUPABASE_URL, avatarPath, STORAGE_BUCKETS.AVATARS);
    if (!base) return null;
    return cacheKey > 0 ? `${base}?v=${cacheKey}` : base;
  }, [avatarPath, cacheKey]);

  const imageUri = localPreviewUri ?? (imageFailed ? null : remoteUri);
  const showInitials = !imageUri;

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
    setImageFailed(false);
    setLocalPreviewUri(asset.uri);

    try {
      const bytes = await readUriAsArrayBuffer(asset.uri);

      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('La imagen no puede superar 2 MB.');
      }

      const mime = asset.mimeType ?? 'image/jpeg';
      const ext = imageExtensionFromMime(mime);
      const path = avatarStoragePath(userId, ext);

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.AVATARS).upload(path, bytes, {
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

      setCacheKey(Date.now());
      onUploaded();
    } catch (err) {
      setLocalPreviewUri(null);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable onPress={() => void pickAndUpload()} disabled={uploading} style={styles.wrapper}>
      <View
        style={[
          styles.avatarFrame,
          {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: showInitials ? `${theme.accent}22` : theme.surfaceMuted,
            borderColor: theme.border,
          },
        ]}
      >
        {showInitials ? (
          <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '700' }}>{initials}</Text>
        ) : (
          <Image
            source={{ uri: imageUri }}
            style={styles.avatarImage}
            resizeMode="cover"
            onError={() => {
              setImageFailed(true);
              setLocalPreviewUri(null);
            }}
          />
        )}
      </View>
      <Text style={[styles.hint, { color: theme.accent2 }]}>
        {uploading ? 'Subiendo…' : 'Toca para cambiar foto'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 8 },
  avatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  avatarImage: { width: '100%', height: '100%' },
  hint: { fontSize: 12, fontWeight: '500' },
});
