'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { platformResendInvitation, platformRevokeInvitation } from '@/app/platform/actions';

export function PlatformInvitationActions({
  invitationId,
  condominiumId,
  status,
}: {
  invitationId: string;
  condominiumId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status !== 'pending') return null;

  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await platformResendInvitation(invitationId, condominiumId);
            if ('error' in result) alert(result.error);
            else alert('Invitación reenviada.');
            router.refresh();
          });
        }}
        className="text-xs text-violet-300 hover:underline disabled:opacity-50"
      >
        Reenviar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm('¿Cancelar esta invitación?')) return;
          startTransition(async () => {
            const result = await platformRevokeInvitation(invitationId, condominiumId);
            if ('error' in result) alert(result.error);
            router.refresh();
          });
        }}
        className="text-xs text-red-300 hover:underline disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  );
}
