'use client';

import { useTransition } from 'react';

import { platformStopImpersonation } from '@/app/platform/impersonation-actions';

export function ImpersonationBanner({ condominiumName }: { condominiumName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-violet-600/40 bg-violet-100 px-4 py-3 text-sm text-violet-950 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Modo soporte: estás viendo <strong>{condominiumName}</strong> como super admin.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void platformStopImpersonation())}
          className="rounded-lg border border-violet-700/50 bg-white px-3 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-50"
        >
          Salir del modo soporte
        </button>
      </div>
    </div>
  );
}
