'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { platformRevokeMembership } from '@/app/(platform)/actions';

export function PlatformRevokeButton({
  membershipId,
  condominiumId,
}: {
  membershipId: string;
  condominiumId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('¿Desactivar esta membresía?')) return;
        startTransition(async () => {
          await platformRevokeMembership(membershipId, condominiumId);
          router.refresh();
        });
      }}
      className="text-xs text-red-300 hover:underline disabled:opacity-50"
    >
      Desactivar
    </button>
  );
}
