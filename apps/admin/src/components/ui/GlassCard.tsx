export function GlassCard({
  children,
  className = '',
  deep,
}: {
  children: React.ReactNode;
  className?: string;
  deep?: boolean;
}) {
  return <div className={`${deep ? 'glass-card-deep' : 'glass-card'} p-6 ${className}`}>{children}</div>;
}
