import { router } from 'expo-router';

export function openInAppDocument(url: string, title?: string) {
  router.push({
    pathname: '/document-viewer',
    params: {
      url,
      title: title ?? 'Documento',
    },
  });
}
