'use client';

import { useContext, useEffect } from 'react';

import {
  PanelPageHeaderContext,
  usePanelPageHeader,
} from '@/components/PanelPageHeaderContext';
import { HelpHint } from '@/components/ui/HelpHint';

function InlinePageHeader({
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
          {highlight ? <span className="text-accent-strong font-semibold italic"> {highlight}</span> : null}
        </h1>
        {help ? <HelpHint label={`Ayuda: ${title}`} className="mt-2">{help}</HelpHint> : null}
      </div>
      {subtitle ? <p className="mt-2 text-sm text-subtle">{subtitle}</p> : null}
    </div>
  );
}

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
  const hasProvider = useContext(PanelPageHeaderContext) !== null;
  const { setHeader } = usePanelPageHeader();

  useEffect(() => {
    if (!hasProvider) return;
    setHeader({ title, highlight, subtitle, help });
    return () => setHeader(null);
  }, [hasProvider, title, highlight, subtitle, help, setHeader]);

  if (!hasProvider) {
    return <InlinePageHeader title={title} highlight={highlight} subtitle={subtitle} help={help} />;
  }

  return null;
}
