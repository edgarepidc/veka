import { HelpHint } from '@/components/ui/HelpHint';

export function SectionHeading({
  as: Tag = 'h2',
  className = 'text-lg font-semibold text-[var(--text)]',
  children,
  help,
  helpLabel,
}: {
  as?: 'h2' | 'h3';
  className?: string;
  children: React.ReactNode;
  help?: React.ReactNode;
  helpLabel?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Tag className={className}>{children}</Tag>
      {help ? (
        <HelpHint label={helpLabel ?? `Ayuda: ${String(children)}`} className="mt-0.5">
          {help}
        </HelpHint>
      ) : null}
    </div>
  );
}
