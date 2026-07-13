'use client';

import { packagePhotoPath, STORAGE_BUCKETS } from '@veka/shared';
import { useState, useTransition } from 'react';

import { registerPackage } from '@/app/(panel)/seguridad/actions';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { UnitScopeSelect, type UnitScopeOption } from '@/components/UnitScopeSelect';
import { HELP } from '@/lib/help-content';

export function PackageRegisterPanel({
  condominiumId,
  units,
  scopeFilter,
}: {
  condominiumId: string;
  units: UnitScopeOption[];
  scopeFilter: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  return (
    <GlassCard>
      <SectionHeading help={HELP.seguridad}>Registrar paquete en caseta</SectionHeading>
      <p className="mt-1 text-sm text-muted">
        Al guardar, los residentes de la unidad reciben una notificación push. Puedes adjuntar una foto
        del paquete.
      </p>

      <form
        key={formKey}
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
            setFormKey((value) => value + 1);
          });
        }}
      >
        <input type="hidden" name="condominium_id" value={condominiumId} />

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Unidad</span>
          <UnitScopeSelect units={units} scopeFilter={scopeFilter} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Paquetería / carrier</span>
          <input name="carrier" placeholder="Amazon, DHL, Estafeta…" className="glass-input" />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Número de guía (opcional)</span>
          <input name="tracking_number" className="glass-input" />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--text)]">Notas (opcional)</span>
          <input name="notes" className="glass-input" />
        </label>

        <FileUpload
          bucket={STORAGE_BUCKETS.PACKAGES}
          inputName="photo_url"
          label="Foto del paquete (opcional)"
          hint="Imagen del paquete en caseta (máx. 2 MB)."
          uploadButtonLabel="Subir foto"
          buildPath={(ext) => packagePhotoPath(condominiumId, crypto.randomUUID(), ext)}
        />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}

        <button
          type="submit"
          disabled={pending || units.length === 0}
          className="glass-btn-primary disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Registrar y notificar'}
        </button>
      </form>
    </GlassCard>
  );
}
