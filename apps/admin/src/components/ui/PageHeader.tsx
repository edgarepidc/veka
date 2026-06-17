export function PageHeader({
  title,
  highlight,
  subtitle,
}: {
  title: string;
  highlight?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="serif-title text-3xl leading-tight text-[var(--text)]">
        {title}
        {highlight ? <span className="text-accent italic"> {highlight}</span> : null}
      </h1>
      {subtitle ? <p className="mt-2 text-sm text-subtle">{subtitle}</p> : null}
    </div>
  );
}
