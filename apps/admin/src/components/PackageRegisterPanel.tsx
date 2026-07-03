'use client';

import { useState, useTransition } from 'react';

import { registerPackage } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';

interface UnitOption {
  id: string;
  identifier: string;
}

export function PackageRegisterPanel({
  condominiumId,
  units,
}: {
  condominiumId: string;
  units: UnitOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <GlassCard>
      <h2 className="text-lg font-semibold text-[var(--text)]">Registrar paquete en caseta</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Al guardar, los residentes de la unidad reciben una notificación push en la app.
      </p>

      <form
        className="mt-4 grid gap-3"
        action={(formData) => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await registerPackage(formData);
            if ('error' in result && result.error) {
              setError(result.error);
              return;
            }
            setMessage('Paquete registrado y notificación enviada.');
          });
        }}
      >
        <input type="hidden" name="condominium_id" value={condominiumId} />

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Unidad</span>
          <select
            name="unit_id"
            required
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
            defaultValue=""
          >
            <option value="" disabled>
              Selecciona unidad
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.identifier}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Paquetería / carrier</span>
          <input
            name="carrier"
            placeholder="Amazon, DHL, Estafeta…"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Número de guía (opcional)</span>
          <input
            name="tracking_number"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Notas (opcional)</span>
          <input
            name="notes"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <button
          type="submit"
          disabled={pending || units.length === 0}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Registrar y notificar'}
        </button>
      </form>
    </GlassCard>
  );
}
