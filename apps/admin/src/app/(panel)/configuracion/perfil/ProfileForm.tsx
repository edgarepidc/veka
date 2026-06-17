'use client';

import { useState, useTransition } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import type { AdminSession } from '@/lib/load-admin-session';

import { updateAdminPassword, updateAdminProfile } from './actions';

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super administrador',
    admin: 'Administrador',
    board_member: 'Mesa directiva',
    resident: 'Residente',
    guard: 'Guardia',
    staff: 'Personal',
  };
  return map[role] ?? role;
}

export function ProfileForm({ session }: { session: AdminSession }) {
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profilePending, startProfile] = useTransition();
  const [passwordPending, startPassword] = useTransition();

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Datos personales</h2>
        <p className="mt-1 text-sm text-muted">
          Esta información se usa en el panel y en comunicaciones con residentes.
        </p>

        <form
          className="mt-6 space-y-4"
          action={(formData) => {
            setProfileMessage(null);
            startProfile(async () => {
              const result = await updateAdminProfile(formData);
              setProfileMessage(result.error ?? 'Perfil actualizado correctamente.');
            });
          }}
        >
          <Field label="Nombre completo" name="full_name" defaultValue={session.profile.full_name ?? ''} />
          <Field label="Teléfono" name="phone" defaultValue={session.profile.phone ?? ''} />
          <Field
            label="URL de avatar (opcional)"
            name="avatar_url"
            defaultValue={session.profile.avatar_url ?? ''}
            placeholder="https://..."
          />
          <ReadOnly label="Correo electrónico" value={session.email} />
          <ReadOnly
            label="Rol en el condominio"
            value={session.membership ? roleLabel(session.membership.role) : 'Sin asignar'}
          />
          <ReadOnly label="Condominio" value={session.membership?.condominium_name ?? 'Sin asignar'} />

          {profileMessage ? (
            <p className={`text-sm ${profileMessage.includes('correctamente') ? 'text-accent' : 'text-red-300'}`}>
              {profileMessage}
            </p>
          ) : null}

          <button type="submit" disabled={profilePending} className="glass-btn-primary">
            {profilePending ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Seguridad</h2>
        <p className="mt-1 text-sm text-muted">Actualiza tu contraseña de acceso al panel.</p>

        <form
          className="mt-6 space-y-4"
          action={(formData) => {
            setPasswordMessage(null);
            startPassword(async () => {
              const result = await updateAdminPassword(formData);
              setPasswordMessage(result.error ?? 'Contraseña actualizada correctamente.');
            });
          }}
        >
          <Field label="Nueva contraseña" name="password" type="password" />
          <Field label="Confirmar contraseña" name="confirm" type="password" />

          {passwordMessage ? (
            <p
              className={`text-sm ${passwordMessage.includes('correctamente') ? 'text-accent' : 'text-red-300'}`}
            >
              {passwordMessage}
            </p>
          ) : null}

          <button type="submit" disabled={passwordPending} className="glass-btn-secondary">
            {passwordPending ? 'Actualizando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="glass-input mt-1"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="glass-card-deep mt-1 px-3 py-2 text-sm text-subtle">{value}</p>
    </div>
  );
}
