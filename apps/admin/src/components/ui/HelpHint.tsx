'use client';

import { useId, useRef, useState } from 'react';

export function HelpHint({
  label = 'Ayuda',
  children,
  className = '',
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-bold leading-none text-subtle transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        ?
      </button>
      {open ? (
        <div
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs leading-relaxed text-muted shadow-xl backdrop-blur-sm"
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
