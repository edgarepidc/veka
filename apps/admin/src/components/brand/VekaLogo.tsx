import { VEKA_BRAND_ASSETS, type VekaLogoVariant } from '@veka/shared';

const SIZES: Record<VekaLogoVariant, { width: number; height: number }> = {
  mark: { width: 48, height: 48 },
  wordmark: { width: 120, height: 36 },
  horizontal: { width: 220, height: 56 },
  stacked: { width: 160, height: 120 },
};

export function VekaLogo({
  variant = 'horizontal',
  className = '',
  framed = true,
}: {
  variant?: VekaLogoVariant;
  className?: string;
  /** Dark frame so the asset reads on light theme surfaces. */
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
