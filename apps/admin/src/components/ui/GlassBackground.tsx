export function GlassBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="glass-bg" style={style}>
      <div className="glass-orb glass-orb-1" aria-hidden />
      <div className="glass-orb glass-orb-2" aria-hidden />
      <div className="glass-orb glass-orb-3" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
