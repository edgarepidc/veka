import Link from 'next/link';
import type { CSSProperties } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { GlassBackground } from '@/components/ui/GlassBackground';
import type { PlatformSession } from '@/lib/platform-admin';

const NAV = [
  { href: '/platform', label: 'Resumen' },
  { href: '/platform/condominios', label: 'Condominios' },
  { href: '/platform/admins', label: 'Equipo Veka' },
];

export function PlatformShell({
  session,
  children,
}: {
  session: PlatformSession;
  children: React.ReactNode;
}) {
  return (
    <GlassBackground
      style={
        {
          '--accent': '#a78bfa',
          '--accent-2': '#6366f1',
        } as CSSProperties
      }
    >
      <div className="flex min-h-screen">
        <aside className="glass-sidebar hidden w-60 shrink-0 border-r border-violet-400/20 lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Veka Platform</p>
            <h1 className="serif-title mt-2 text-xl text-[var(--text)]">Administración</h1>
            <p className="mt-1 text-xs text-subtle">Dueños de la app</p>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-[var(--text)] transition hover:bg-violet-500/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-4 text-xs text-subtle">
            <p className="truncate">{session.email}</p>
            <Link href="/" className="mt-2 inline-block text-violet-300 hover:underline">
              Ir al panel condo
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Veka Platform</p>
              <p className="text-xs text-subtle lg:hidden">{session.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <AppearancePicker compact />
              <Link href="/" className="text-xs text-violet-300 hover:underline">
                Panel condo
              </Link>
              <SignOutButton />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </GlassBackground>
  );
}
