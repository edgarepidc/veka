'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setActiveCondominium } from '@/app/(panel)/configuracion/condominio/actions/set-active-condo';
import type { UserCondominium } from '@/lib/condominium-context';

export function CondominiumSwitcher({
  condominiums,
  activeCondominiumId,
}: {
  condominiums: UserCondominium[];
  activeCondominiumId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (condominiums.length <= 1) return null;

  return (
    <label className="hidden items-center gap-2 text-xs text-subtle sm:flex">
      <span>Condominio</span>
      <select
        value={activeCondominiumId ?? ''}
        disabled={pending}
        onChange={(event) => {
          const nextId = event.target.value;
          startTransition(async () => {
            const result = await setActiveCondominium(nextId);
            if (!result?.error) router.refresh();
          });
        }}
        className="glass-input max-w-[200px] py-1.5 text-sm"
      >
        {condominiums.map((condo) => (
          <option key={condo.id} value={condo.id} className="bg-slate-900">
            {condo.name}
          </option>
        ))}
      </select>
    </label>
  );
}
