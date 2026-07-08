'use client';

import { useState, useTransition } from 'react';

import { updateSecuritySettings } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import type { SecuritySettings } from '@veka/shared';

export function SecuritySettingsPanel({
  condominiumId,
  settings,
  canEdit,
}: {
  condominiumId: string;
  settings: SecuritySettings;
  canEdit: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const blockRental = Boolean(settings.block_rental_visits_if_overdue);

  if (!canEdit) {
    return (
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Políticas de acceso</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Rentas con adeudos: {blockRental ? 'bloqueadas' : 'permitidas'}.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <h2 className="text-lg font-semibold text-[var(--text)]">Políticas de acceso</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Configura restricciones para pases de renta generados por residentes.
      </p>

      <form
        className="mt-4 space-y-3"
        action={(formData) => {
          setMessage(null);
          startTransition(async () => {
            const result = await updateSecuritySettings(formData);
            setMessage('error' in result && result.error ? result.error : 'Configuración guardada.');
          });
        }}
      >
        <input type="hidden" name="condominium_id" value={condominiumId} />
        <label className="flex items-start gap-3 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            name="block_rental_visits_if_overdue"
            defaultChecked={blockRental}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Restringir rentas con adeudos de mantenimiento</span>
            <span className="mt-1 block text-[var(--text-muted)]">
              Si la unidad tiene cuotas vencidas o pendientes después de la fecha de pago, no podrá generar
              pases de renta en la app.
            </span>
          </span>
        </label>

        {message ? (
          <p className={`text-sm ${message.includes('Error') || message.includes('error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar políticas'}
        </button>
      </form>
    </GlassCard>
  );
}
