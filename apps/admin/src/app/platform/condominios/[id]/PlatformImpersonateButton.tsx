'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { platformStartImpersonation } from '@/app/platform/impersonation-actions';

export function PlatformImpersonateButton({
  condominiumId,
  compact = false,
}: {
  condominiumId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await platformStartImpersonation(condominiumId);
          router.refresh();
        });
      }}
      className={
        compact
          ? 'text-xs font-medium text-violet-700 hover:underline disabled:opacity-50'
          : 'glass-btn-primary text-sm disabled:opacity-50'
      }
    >
      {pending ? 'Entrando…' : compact ? 'Entrar' : 'Entrar como admin'}
    </button>
  );
}
