'use client';

import Link from 'next/link';

import { usePanelPageHeader } from '@/components/PanelPageHeaderContext';
import { CondominiumSwitcher } from '@/components/CondominiumSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { HelpHint } from '@/components/ui/HelpHint';
import type { AdminSession } from '@/lib/load-admin-session';

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

export function AdminTopBar({
  session,
  avatarUrl,
  initials,
  displayName,
  isPlatformAdmin,
}: {
  session: AdminSession;
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  isPlatformAdmin: boolean;
}) {
  const { header } = usePanelPageHeader();

  return (
    <header className="glass-header px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {header ? (
            <>
              <div className="flex items-start gap-2">
                <h1 className="serif-title text-2xl leading-tight text-[var(--text)] sm:text-[1.65rem]">
                  {header.title}
                  {header.highlight ? (
                    <span className="text-accent-strong font-semibold italic"> {header.highlight}</span>
                  ) : null}
                </h1>
                {header.help ? (
                  <HelpHint label={`Ayuda: ${header.title}`} className="mt-1.5 shrink-0">
                    {header.help}
                  </HelpHint>
                ) : null}
              </div>
              {header.subtitle ? (
                <p className="mt-1 max-w-3xl text-sm text-muted">{header.subtitle}</p>
              ) : null}
            </>
          ) : (
            <p className="serif-title text-lg text-[var(--text)] lg:hidden">Veka</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
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
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-sm font-bold text-accent">
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
  );
}
