export const VEKA_BRAND_NAME = 'Veka';
export const VEKA_BRAND_TAGLINE = 'Administración residencial';

/** Relative paths under `apps/admin/public/brand/`. */
export const VEKA_BRAND_ASSETS = {
  mark: '/brand/veka-mark.png',
  wordmark: '/brand/veka-wordmark.png',
  horizontal: '/brand/veka-lockup-horizontal.png',
  stacked: '/brand/veka-lockup-stacked.png',
} as const;

export type VekaLogoVariant = keyof typeof VEKA_BRAND_ASSETS;
