'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { platformAddPlatformAdmin, platformRemovePlatformAdmin } from '@/app/platform/actions';

export function PlatformAdminsManager({
  admins,
  currentUserId,
}: {
  admins: { user_id: string; email: string | null; notes: string | null; created_at: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        action={(formData) => {
          setMessage(null);
          startTransition(async () => {
            const result = await platformAddPlatformAdmin(formData);
            setMessage('error' in result ? result.error : 'Administrador agregado.');
            if (!('error' in result)) router.refresh();
          });
        }}
      >
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-subtle">Nombre</label>
          <input
            name="full_name"
            required
            className="glass-input mt-1 w-full"
            placeholder="Nombre completo"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-subtle">Correo</label>
          <input
            name="email"
            type="email"
            required
            className="glass-input mt-1 w-full"
            placeholder="admin@vekacondo.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-subtle">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="glass-input mt-1 w-full"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-subtle">Teléfono</label>
          <input name="phone" type="tel" className="glass-input mt-1 w-full" placeholder="Opcional" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-subtle">Notas</label>
          <input name="notes" className="glass-input mt-1 w-full" placeholder="Opcional" />
        </div>
        <button type="submit" disabled={pending} className="glass-btn-primary text-sm disabled:opacity-50">
          Registrar platform admin
        </button>
        <p className="text-xs text-subtle">
          Si el correo ya existe, se actualiza el perfil y se otorga acceso (sin cambiar la contraseña).
        </p>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </form>

      <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
        {admins.map((admin) => (
          <li key={admin.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium text-[var(--text)]">{admin.email ?? admin.user_id}</p>
              {admin.notes ? <p className="text-xs text-subtle">{admin.notes}</p> : null}
            </div>
            {admin.user_id !== currentUserId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm('¿Quitar acceso de platform admin?')) return;
                  startTransition(async () => {
                    const result = await platformRemovePlatformAdmin(admin.user_id);
                    if ('error' in result) alert(result.error);
                    router.refresh();
                  });
                }}
                className="text-xs text-red-300 hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            ) : (
              <span className="text-xs text-subtle">Tú</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
