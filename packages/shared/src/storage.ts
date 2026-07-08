export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  BRANDING: 'branding',
  AMENITY_IMAGES: 'amenity-images',
  DOCUMENTS: 'documents',
  EXPENSE_EVIDENCE: 'expense-evidence',
  MAINTENANCE_FILES: 'maintenance-files',
  POSTS: 'posts',
} as const;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function avatarStoragePath(userId: string, ext: string): string {
  return `${userId}/avatar.${ext}`;
}

export function condominiumLogoPath(condominiumId: string, ext: string): string {
  return `${condominiumId}/logo.${ext}`;
}

export function amenityImagePath(condominiumId: string, amenityId: string, ext: string): string {
  return `${condominiumId}/amenities/${amenityId}.${ext}`;
}

export function expenseEvidencePath(condominiumId: string, fileId: string, ext: string): string {
  return `${condominiumId}/expenses/${fileId}.${ext}`;
}

export function maintenanceFilePath(
  condominiumId: string,
  folder: 'schedules' | 'evidence' | 'tickets',
  fileId: string,
  ext: string,
): string {
  return `${condominiumId}/${folder}/${fileId}.${ext}`;
}

export function documentStoragePath(condominiumId: string, fileId: string, ext: string): string {
  return `${condominiumId}/documents/${fileId}.${ext}`;
}

export function postImagePath(condominiumId: string, postId: string, ext: string): string {
  return `${condominiumId}/posts/${postId}.${ext}`;
}

export function publicStorageUrl(supabaseUrl: string, bucket: string, path: string): string {
  const base = supabaseUrl.replace(/\/$/, '');
  const encoded = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Resolves a storage path or legacy full URL to a displayable image URL. */
export function resolveStorageImageUrl(
  supabaseUrl: string,
  pathOrUrl: string | null | undefined,
  bucket: string,
): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return publicStorageUrl(supabaseUrl, bucket, pathOrUrl);
}

export function imageExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
  };
  return map[mime] ?? 'bin';
}
