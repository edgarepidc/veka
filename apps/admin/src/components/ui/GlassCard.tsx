import type { CardAccentTone } from '@veka/shared';

export type GlassCardVariant = 'default' | 'accent' | 'muted';

export function GlassCard({
  children,
  className = '',
  deep,
  variant = 'default',
  accent = 'blue',
}: {
  children: React.ReactNode;
  className?: string;
  deep?: boolean;
  variant?: GlassCardVariant;
  accent?: CardAccentTone;
}) {
  let base = deep ? 'glass-card-deep' : 'glass-card';

  if (variant === 'muted') {
    base = 'glass-card-muted';
  } else if (variant === 'accent') {
    base = `glass-card glass-card-accent glass-card-accent-${accent}`;
  }

  return <div className={`${base} p-6 ${className}`}>{children}</div>;
}
