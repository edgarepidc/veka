'use client';

import { useTransition } from 'react';

import { platformStopImpersonation } from '@/app/platform/impersonation-actions';

export function ImpersonationBanner({ condominiumName }: { condominiumName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-violet-400/30 bg-violet-500/15 px-4 py-3 text-sm text-violet-100 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Modo soporte: estás viendo <strong>{condominiumName}</strong> como super admin.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void platformStopImpersonation())}
          className="rounded-lg border border-violet-300/40 px-3 py-1 text-xs font-semibold text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
        >
          Salir del modo soporte
        </button>
      </div>
    </div>
  );
}
