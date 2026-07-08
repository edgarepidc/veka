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

/** Opens the photo library and allows selecting multiple images. */
export async function pickImagesFromLibrary(): Promise<PickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para adjuntar imágenes.');
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: true,
  });

  if (result.canceled || result.assets.length === 0) return [];

  return result.assets.map((asset, index) => {
    const mime = asset.mimeType ?? 'image/jpeg';
    const ext = imageExtensionFromMime(mime);
    return {
      uri: asset.uri,
      mimeType: mime,
      name: `photo-${index}.${ext}`,
    };
  });
}
