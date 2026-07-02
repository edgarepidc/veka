'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { platformCreateCondominium } from '@/app/(platform)/actions';

export function PlatformCreateCondominiumForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await platformCreateCondominium(formData);
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      if ('condominiumId' in result && result.condominiumId) {
        router.push(`/platform/condominios/${result.condominiumId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nombre del condominio" name="name" required placeholder="Residencial Las Palmas" />
      <Field label="Organización (opcional)" name="organization_name" placeholder="Grupo inmobiliario" />
      <Field label="Dirección" name="address" placeholder="Calle, colonia, ciudad" />
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Zona horaria</span>
        <select name="timezone" className="glass-input w-full" defaultValue="America/Mexico_City">
          <option value="America/Mexico_City" className="bg-slate-900">
            Ciudad de México
          </option>
          <option value="America/Cancun" className="bg-slate-900">
            Cancún
          </option>
          <option value="America/Tijuana" className="bg-slate-900">
            Tijuana
          </option>
        </select>
      </label>
      <hr className="border-white/10" />
      <p className="text-sm text-muted">Administrador inicial del condominio (opcional pero recomendado)</p>
      <Field label="Correo del administrador" name="admin_email" type="email" placeholder="admin@cliente.com" />
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Rol inicial</span>
        <select name="admin_role" className="glass-input w-full" defaultValue="super_admin">
          <option value="super_admin" className="bg-slate-900">
            Super admin
          </option>
          <option value="admin" className="bg-slate-900">
            Administrador
          </option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="glass-btn-primary w-full py-2.5 text-sm font-semibold">
        {pending ? 'Creando…' : 'Crear condominio'}
      </button>
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
    </form>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
  type = 'text',
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-subtle">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="glass-input w-full"
      />
    </label>
  );
}
