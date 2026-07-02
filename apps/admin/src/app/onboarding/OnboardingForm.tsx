'use client';

import { useState, useTransition } from 'react';

import { createCondominiumOnboarding } from './actions';

export function OnboardingForm() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData();
    formData.set('name', name);
    formData.set('address', address);
    formData.set('timezone', timezone);

    startTransition(async () => {
      const result = await createCondominiumOnboarding(formData);
      if (result?.error) setMessage(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Nombre del condominio</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="glass-input w-full"
          placeholder="Residencial Las Palmas"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Dirección (opcional)</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="glass-input w-full"
          placeholder="Calle, colonia, ciudad"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Zona horaria</span>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="glass-input w-full">
          <option value="America/Mexico_City" className="bg-slate-900">
            Ciudad de México
          </option>
          <option value="America/Cancun" className="bg-slate-900">
            Cancún
          </option>
          <option value="America/Tijuana" className="bg-slate-900">
            Tijuana
          </option>
          <option value="America/Mazatlan" className="bg-slate-900">
            Mazatlán
          </option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="glass-btn-primary w-full py-2.5 text-sm font-semibold">
        {pending ? 'Creando condominio…' : 'Crear condominio'}
      </button>
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
    </form>
  );
}
