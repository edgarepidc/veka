'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { platformSetCondominiumStatus } from '@/app/platform/actions';
import type { CondominiumStatus } from '@/lib/condominium-status';
import { CONDOMINIUM_STATUS_LABELS, statusBadgeClass } from '@/lib/condominium-status';
import { GlassCard } from '@/components/ui/GlassCard';

const STATUS_OPTIONS: CondominiumStatus[] = ['active', 'suspended', 'archived'];

export function PlatformCondominiumStatusPanel({
  condominiumId,
  status,
}: {
  condominiumId: string;
  status: CondominiumStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: CondominiumStatus) {
    if (next === status) return;
    const label = CONDOMINIUM_STATUS_LABELS[next];
    if (!confirm(`¿Cambiar el estado del condominio a "${label}"?`)) return;

    startTransition(async () => {
      const result = await platformSetCondominiumStatus(condominiumId, next);
      if ('error' in result) alert(result.error);
      router.refresh();
    });
  }

  return (
    <GlassCard className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Estado del tenant</h2>
          <p className="mt-1 text-sm text-muted">
            Suspende el acceso de usuarios o archiva el condominio sin borrar datos.
          </p>
          <p className="mt-3">
            <span className={statusBadgeClass(status)}>{CONDOMINIUM_STATUS_LABELS[status]}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending || option === status}
              onClick={() => setStatus(option)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                option === status
                  ? 'border-violet-600 bg-violet-100 font-semibold text-violet-900'
                  : 'border-white/10 text-muted hover:border-white/20 hover:text-[var(--text)]'
              }`}
            >
              {CONDOMINIUM_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
