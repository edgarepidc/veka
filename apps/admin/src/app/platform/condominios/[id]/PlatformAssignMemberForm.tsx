'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { MembershipRole } from '@veka/shared';

import { platformAssignMembership } from '@/app/platform/actions';

const ROLES: { value: MembershipRole; label: string }[] = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'admin', label: 'Administrador' },
  { value: 'board_member', label: 'Mesa directiva' },
  { value: 'guard', label: 'Guardia' },
  { value: 'staff', label: 'Personal' },
];

export function PlatformAssignMemberForm({ condominiumId }: { condominiumId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    formData.set('condominium_id', condominiumId);

    startTransition(async () => {
      const result = await platformAssignMembership(formData);
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Acceso registrado. La persona ya puede iniciar sesión.');
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        required
        name="full_name"
        placeholder="Nombre completo"
        className="glass-input w-full"
        autoComplete="name"
      />
      <input
        required
        type="email"
        name="email"
        placeholder="correo@administrador.com"
        className="glass-input w-full"
        autoComplete="email"
      />
      <input
        required
        type="password"
        name="password"
        placeholder="Contraseña (mín. 8)"
        minLength={8}
        className="glass-input w-full"
        autoComplete="new-password"
      />
      <input
        name="phone"
        type="tel"
        placeholder="Teléfono (opcional)"
        className="glass-input w-full"
        autoComplete="tel"
      />
      <select name="role" defaultValue="admin" className="glass-input w-full">
        {ROLES.map((role) => (
          <option key={role.value} value={role.value} className="bg-slate-900">
            {role.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="glass-btn-primary w-full text-sm">
        {pending ? 'Registrando…' : 'Registrar acceso'}
      </button>
      <p className="text-xs text-subtle">
        Crea la cuenta y el acceso de inmediato. Si el correo ya existe, se actualiza el perfil y la
        membresía (sin cambiar la contraseña).
      </p>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
