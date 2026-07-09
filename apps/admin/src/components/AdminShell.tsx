import Link from 'next/link';
import type { CSSProperties } from 'react';
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';
import { AdminNav } from '@/components/AdminNav';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { CondominiumSwitcher } from '@/components/CondominiumSwitcher';
import { GlassBackground } from '@/components/ui/GlassBackground';
import type { CondominiumBranding } from '@/lib/condominium-settings';
import { DEFAULT_BRANDING } from '@/lib/condominium-settings';
import type { AdminSession } from '@/lib/load-admin-session';
import { SignOutButton } from '@/components/SignOutButton';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super admin',
    admin: 'Administrador',
    board_member: 'Mesa directiva',
    resident: 'Residente',
    guard: 'Guardia',
    staff: 'Personal',
  };
  return map[role] ?? role;
}

export function AdminShell({
  session,
  branding,
  isPlatformAdmin = false,
  children,
}: {
  session: AdminSession;
  branding?: CondominiumBranding;
  isPlatformAdmin?: boolean;
  children: React.ReactNode;
}) {
  const displayName = session.profile.full_name ?? session.email.split('@')[0] ?? 'Usuario';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const logoUrl = resolveStorageImageUrl(
    SUPABASE_URL,
    branding?.logo_url,
    STORAGE_BUCKETS.BRANDING,
  );
  const avatarUrl = resolveStorageImageUrl(
    SUPABASE_URL,
    session.profile.avatar_url,
    STORAGE_BUCKETS.AVATARS,
  );
  const accent = branding?.primary_color ?? DEFAULT_BRANDING.primary_color;

  return (
    <GlassBackground
      style={
        {
          '--accent': accent,
          '--accent-2': branding?.accent_color ?? DEFAULT_BRANDING.accent_color,
        } as CSSProperties
      }
    >
      <div className="flex min-h-screen">
        <aside className="glass-sidebar hidden w-64 shrink-0 lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {session.isAdmin ? 'Panel admin' : session.canAccessSecurity ? 'Caseta' : 'Portal residente'}
            </p>
            <div className="mt-2 flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
              ) : null}
              <div className="min-w-0">
                <h1 className="serif-title truncate text-2xl text-[var(--text)]">
                  {session.membership?.condominium_name ?? 'Veka'}
                </h1>
                <p className="mt-0.5 text-xs text-subtle">Powered by Veka</p>
              </div>
            </div>
          </div>
          <AdminNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="lg:hidden">
                <p className="serif-title text-lg text-[var(--text)]">Veka</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                <div className="hidden lg:block">
                  <AppearancePicker compact />
                </div>
                {isPlatformAdmin ? (
                  <Link
                    href="/platform"
                    className="hidden rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 sm:inline-block"
                  >
                    Veka Platform
                  </Link>
                ) : null}
                {session.isAdmin ? (
                  <CondominiumSwitcher
                    condominiums={session.condominiums}
                    activeCondominiumId={session.activeCondominiumId}
                  />
                ) : null}
                <Link
                  href="/configuracion/perfil"
                  className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[rgba(52,211,153,0.2)] text-sm font-bold text-accent">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials || 'AD'
                    )}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-[var(--text)]">{displayName}</p>
                    <p className="text-xs text-subtle">
                      {session.membership ? roleLabel(session.membership.role) : 'Sin rol asignado'}
                    </p>
                  </div>
                </Link>
                <SignOutButton />
              </div>
            </div>
          </header>

          {!session.isAdmin && !session.canAccessSecurity ? (
            <div className="border-b border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100 sm:px-6">
              Estás en el portal de residente. Para pagar cuotas ve a{' '}
              <a href="/mi-cuenta" className="font-semibold underline">
                Mi cuenta
              </a>
              . La configuración del condominio es solo para administradores.
            </div>
          ) : null}

          {session.isImpersonating && session.membership ? (
            <ImpersonationBanner condominiumName={session.membership.condominium_name} />
          ) : null}

          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </GlassBackground>
  );
}
