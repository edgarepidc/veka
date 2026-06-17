import Link from 'next/link';
import type { CSSProperties } from 'react';

import { GlassBackground } from '@/components/ui/GlassBackground';
import type { CondominiumBranding } from '@/lib/condominium-settings';
import { DEFAULT_BRANDING } from '@/lib/condominium-settings';
import type { AdminSession } from '@/lib/load-admin-session';
import { SignOutButton } from '@/components/SignOutButton';

const NAV = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/finanzas', label: 'Finanzas', icon: '💳' },
  { href: '/comunidad', label: 'Comunidad', icon: '💬' },
  { href: '/espacios', label: 'Espacios', icon: '🏊' },
  { href: '/seguridad', label: 'Seguridad', icon: '🔒' },
  { href: '/configuracion/perfil', label: 'Configuración', icon: '⚙️' },
];

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
  children,
}: {
  session: AdminSession;
  branding?: CondominiumBranding;
  children: React.ReactNode;
}) {
  const displayName = session.profile.full_name ?? session.email.split('@')[0] ?? 'Usuario';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const logoUrl = branding?.logo_url;
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
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Panel admin</p>
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
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-white/10 hover:text-[var(--text)]"
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="lg:hidden">
                <p className="serif-title text-lg text-[var(--text)]">Veka</p>
              </div>
              <div className="flex items-center gap-3 sm:ml-auto">
                <Link
                  href="/configuracion/perfil"
                  className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(52,211,153,0.2)] text-sm font-bold text-accent">
                    {initials || 'AD'}
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

          {!session.isAdmin ? (
            <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 sm:px-6">
              Tu cuenta no tiene rol de administrador. Puedes editar tu perfil; las acciones operativas
              requieren permisos de admin.
            </div>
          ) : null}

          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </GlassBackground>
  );
}
