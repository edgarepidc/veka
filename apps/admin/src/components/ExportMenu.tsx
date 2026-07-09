'use client';

import { useState } from 'react';

export function ExportMenu({
  onCsv,
  onPdf,
  onPolizaCsv,
  disabled = false,
  label = 'Exportar',
  variant = 'default',
}: {
  onCsv: () => void;
  onPdf: () => void | Promise<void>;
  onPolizaCsv?: () => void;
  disabled?: boolean;
  label?: string;
  variant?: 'default' | 'chip';
}) {
  const [pdfPending, setPdfPending] = useState(false);

  async function handlePdf() {
    setPdfPending(true);
    try {
      await onPdf();
    } finally {
      setPdfPending(false);
    }
  }

  if (variant === 'chip') {
    return (
      <div className="glass-tab-strip inline-flex shrink-0" role="group" aria-label={label}>
        <button
          type="button"
          disabled={disabled}
          onClick={onCsv}
          className="glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs disabled:opacity-50"
        >
          CSV
        </button>
        {onPolizaCsv ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onPolizaCsv}
            className="glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            Póliza
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled || pdfPending}
          onClick={() => void handlePdf()}
          className="glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs disabled:opacity-50"
        >
          {pdfPending ? '…' : 'PDF'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onCsv}
        className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        Excel (CSV)
      </button>
      {onPolizaCsv ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onPolizaCsv}
          className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          Póliza contable
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled || pdfPending}
        onClick={() => void handlePdf()}
        className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {pdfPending ? 'Generando…' : 'PDF'}
      </button>
    </div>
  );
}
