'use client';

import { useState, useTransition } from 'react';
import { condominiumLogoPath, resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { ImageUpload } from '@/components/ui/ImageUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { DEFAULT_BRANDING } from '@/lib/condominium-settings';
import type { CondominiumSettings } from '@/lib/condominium-settings';

import { updateCondominium } from './actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const TIMEZONES = [
  'America/Mexico_City',
  'America/Cancun',
  'America/Merida',
  'America/Monterrey',
  'America/Tijuana',
  'America/Chihuahua',
];

export function CondominiumForm({
  condo,
}: {
  condo: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    settings: CondominiumSettings;
  };
}) {
  const branding = condo.settings.branding ?? {};
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const logoPreview = resolveStorageImageUrl(SUPABASE_URL, branding.logo_url, STORAGE_BUCKETS.BRANDING);

  return (
    <>
      <GlassCard className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Marca y apariencia</h2>
        <p className="mt-1 text-sm text-muted">
          Sube el logo y define los colores que verán residentes en la app y en este panel.
        </p>

        <form
          className="mt-6 space-y-4"
          action={(formData) => {
            setMessage(null);
            start(async () => {
              const result = await updateCondominium(formData);
              setMessage(result.error ?? 'Marca actualizada correctamente.');
            });
          }}
        >
          <input type="hidden" name="name" value={condo.name} />
          <input type="hidden" name="slug" value={condo.slug} />
          <input type="hidden" name="address" value={condo.address ?? ''} />
          <input type="hidden" name="timezone" value={condo.timezone} />

          <ImageUpload
            bucket={STORAGE_BUCKETS.BRANDING}
            buildPath={(ext) => condominiumLogoPath(condo.id, ext)}
            currentPath={branding.logo_url}
            inputName="logo_url"
            label="Logo del condominio"
            hint="PNG o JPG con fondo transparente, máximo 2 MB."
            previewClassName="max-h-16 max-w-[200px] object-contain"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-muted">
              Color primario
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  name="primary_color"
                  defaultValue={branding.primary_color ?? DEFAULT_BRANDING.primary_color}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                />
                <span className="text-xs text-subtle">
                  {branding.primary_color ?? DEFAULT_BRANDING.primary_color}
                </span>
              </div>
            </label>
            <label className="block text-sm font-medium text-muted">
              Color de acento
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  name="accent_color"
                  defaultValue={branding.accent_color ?? DEFAULT_BRANDING.accent_color}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                />
                <span className="text-xs text-subtle">
                  {branding.accent_color ?? DEFAULT_BRANDING.accent_color}
                </span>
              </div>
            </label>
          </div>

          {logoPreview ? (
            <p className="text-xs text-subtle">El logo guardado se muestra en el menú lateral del panel.</p>
          ) : null}

          <button type="submit" disabled={pending} className="glass-btn-primary">
            {pending ? 'Guardando…' : 'Guardar marca'}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Datos del condominio</h2>
        <p className="mt-1 text-sm text-muted">
          Información general visible para residentes y usada en reportes.
        </p>

        <form
          className="mt-6 space-y-4"
          action={(formData) => {
            setMessage(null);
            start(async () => {
              const result = await updateCondominium(formData);
              setMessage(result.error ?? 'Condominio actualizado correctamente.');
            });
          }}
        >
          <input type="hidden" name="logo_url" value={branding.logo_url ?? ''} />
          <input
            type="hidden"
            name="primary_color"
            value={branding.primary_color ?? DEFAULT_BRANDING.primary_color}
          />
          <input
            type="hidden"
            name="accent_color"
            value={branding.accent_color ?? DEFAULT_BRANDING.accent_color}
          />

          <Field label="Nombre" name="name" defaultValue={condo.name} required />
          <Field label="Slug (URL interna)" name="slug" defaultValue={condo.slug} required />
          <Field label="Dirección" name="address" defaultValue={condo.address ?? ''} />
          <label className="block text-sm font-medium text-muted">
            Zona horaria
            <select name="timezone" defaultValue={condo.timezone} className="glass-input mt-1">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-slate-900">
                  {tz}
                </option>
              ))}
            </select>
          </label>

          {message ? (
            <p className={`text-sm ${message.includes('correctamente') ? 'text-accent' : 'text-red-300'}`}>
              {message}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className="glass-btn-primary">
            {pending ? 'Guardando…' : 'Guardar condominio'}
          </button>
        </form>
      </GlassCard>
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="glass-input mt-1"
      />
    </label>
  );
}
