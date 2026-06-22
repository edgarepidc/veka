import { HelpHint } from '@/components/ui/HelpHint';

export function PageHeader({
  title,
  highlight,
  subtitle,
  help,
}: {
  title: string;
  highlight?: string;
  subtitle?: string;
  help?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-2">
        <h1 className="serif-title text-3xl leading-tight text-[var(--text)]">
          {title}
          {highlight ? <span className="text-accent italic"> {highlight}</span> : null}
        </h1>
        {help ? <HelpHint label={`Ayuda: ${title}`} className="mt-2">{help}</HelpHint> : null}
      </div>
      {subtitle ? <p className="mt-2 text-sm text-subtle">{subtitle}</p> : null}
    </div>
  );
}
