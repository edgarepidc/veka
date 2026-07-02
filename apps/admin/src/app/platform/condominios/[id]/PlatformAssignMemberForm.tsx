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
      const mode = 'mode' in result && result.mode === 'invitation' ? 'invitación enviada' : 'acceso asignado';
      setMessage(`Listo: ${mode}.`);
      event.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        required
        type="email"
        name="email"
        placeholder="correo@administrador.com"
        className="glass-input w-full"
      />
      <select name="role" defaultValue="admin" className="glass-input w-full">
        {ROLES.map((role) => (
          <option key={role.value} value={role.value} className="bg-slate-900">
            {role.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="glass-btn-primary w-full text-sm">
        {pending ? 'Asignando…' : 'Asignar administrador'}
      </button>
      <p className="text-xs text-subtle">
        Si el correo ya tiene cuenta en Veka se asigna de inmediato; si no, se crea una invitación con email.
      </p>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
