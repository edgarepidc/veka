import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { imageExtensionFromMime } from '@veka/shared';

export interface PickedImage {
  uri: string;
  mimeType: string;
  name: string;
}

/** Opens the device photo library (camera roll), not the Files app. */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para adjuntar una imagen.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  const ext = imageExtensionFromMime(mime);

  return {
    uri: asset.uri,
    mimeType: mime,
    name: `photo.${ext}`,
  };
}
