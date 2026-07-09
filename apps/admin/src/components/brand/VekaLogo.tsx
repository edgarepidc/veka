import { VEKA_BRAND_ASSETS, type VekaLogoVariant } from '@veka/shared';

const SIZES: Record<VekaLogoVariant, { width: number; height: number }> = {
  mark: { width: 56, height: 56 },
  wordmark: { width: 120, height: 36 },
  horizontal: { width: 220, height: 56 },
  stacked: { width: 140, height: 180 },
};

export function VekaLogo({
  variant = 'horizontal',
  className = '',
  framed = false,
}: {
  variant?: VekaLogoVariant;
  className?: string;
  /** Optional dark frame for assets without their own background. */
  framed?: boolean;
}) {
  const size = SIZES[variant];
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={VEKA_BRAND_ASSETS[variant]}
      alt="Veka"
      width={size.width}
      height={size.height}
      className="h-auto max-w-full object-contain"
      style={{ width: size.width, height: 'auto' }}
    />
  );

  if (!framed) {
    return <div className={className}>{img}</div>;
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-2xl bg-black px-3 py-2 ${className}`}
    >
      {img}
    </div>
  );
}
