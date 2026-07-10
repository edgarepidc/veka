'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { avatarStoragePath, resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

import { ImageUpload } from '@/components/ui/ImageUpload';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { GlassCard } from '@/components/ui/GlassCard';
import type { AdminSession } from '@/lib/load-admin-session';

import { updateAdminPassword, updateAdminProfile } from './actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

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
  const router = useRouter();
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profilePending, startProfile] = useTransition();
  const [passwordPending, startPassword] = useTransition();

  const avatarPreview = resolveStorageImageUrl(
    SUPABASE_URL,
    session.profile.avatar_url,
    STORAGE_BUCKETS.AVATARS,
  );

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Datos personales</h2>
        <p className="mt-1 text-sm text-muted">
          Esta información se usa en el panel y en comunicaciones con residentes.
        </p>

        <form
          key={`${session.userId}-${session.profile.avatar_url ?? ''}-${session.profile.full_name ?? ''}`}
          className="mt-6 space-y-4"
          action={(formData) => {
            setProfileMessage(null);
            startProfile(async () => {
              const result = await updateAdminProfile(formData);
              if (result.error) {
                setProfileMessage(result.error);
                return;
              }
              setProfileMessage('Perfil actualizado correctamente.');
              router.refresh();
            });
          }}
        >
          <ImageUpload
            bucket={STORAGE_BUCKETS.AVATARS}
            buildPath={(ext) => avatarStoragePath(session.userId, ext)}
            currentPath={session.profile.avatar_url}
            inputName="avatar_url"
            label="Foto de perfil"
            hint="JPG o PNG, máximo 2 MB."
            previewClassName="h-20 w-20 rounded-full object-cover"
          />

          {avatarPreview ? null : (
            <p className="text-xs text-subtle">Si no subes foto, se muestran tus iniciales.</p>
          )}

          <Field label="Nombre completo" name="full_name" defaultValue={session.profile.full_name ?? ''} />
          <Field label="Teléfono" name="phone" defaultValue={session.profile.phone ?? ''} />
          <label className="flex items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              name="show_phone_in_directory"
              value="true"
              defaultChecked={session.profile.show_phone_in_directory}
              className="mt-1 h-4 w-4 rounded border-white/20"
            />
            <span>
              <span className="font-medium text-[var(--text)]">Mostrar mi teléfono en el directorio</span>
              <span className="mt-0.5 block text-xs text-subtle">
                Si lo activas, el número aparece en Comunidad → Mi comunidad (comité y perfiles de residente).
              </span>
            </span>
          </label>
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
        <h2 className="text-lg font-semibold text-[var(--text)]">Apariencia</h2>
        <p className="mt-1 text-sm text-muted">
          Elige tema claro u oscuro para el panel. La preferencia se guarda en este navegador.
        </p>
        <div className="mt-4 max-w-md">
          <AppearancePicker />
        </div>
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
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
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
