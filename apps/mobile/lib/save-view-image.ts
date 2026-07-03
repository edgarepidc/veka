import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Alert, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';

export async function captureViewToPng(viewRef: RefObject<unknown>): Promise<string | null> {
  if (!viewRef.current) return null;
  return captureRef(viewRef as RefObject<View>, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
}

export async function saveImageToGallery(uri: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, error: 'Necesitamos permiso para guardar en tu galería.' };
  }

  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo guardar la imagen.',
    };
  }
}

export async function shareImage(uri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('No disponible', 'Compartir no está disponible en este dispositivo.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir pase de visita' });
}

export async function saveViewToGallery(viewRef: RefObject<unknown>): Promise<void> {
  const uri = await captureViewToPng(viewRef);
  if (!uri) {
    Alert.alert('Error', 'No se pudo generar la imagen del pase.');
    return;
  }

  const result = await saveImageToGallery(uri);
  if (!result.ok) {
    Alert.alert('No se pudo guardar', result.error);
    return;
  }

  Alert.alert('Pase guardado', 'La imagen quedó en tu galería de fotos.');
}

export async function shareViewImage(viewRef: RefObject<unknown>): Promise<void> {
  const uri = await captureViewToPng(viewRef);
  if (!uri) {
    Alert.alert('Error', 'No se pudo generar la imagen del pase.');
    return;
  }
  await shareImage(uri);
}
