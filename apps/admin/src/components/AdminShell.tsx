import type { CSSProperties } from 'react';
import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';
import { AdminNav } from '@/components/AdminNav';
import { AdminTopBar } from '@/components/AdminTopBar';
import { PanelPageHeaderProvider } from '@/components/PanelPageHeaderContext';
import { VekaLogo } from '@/components/brand/VekaLogo';
import { GlassBackground } from '@/components/ui/GlassBackground';
import type { CondominiumBranding } from '@/lib/condominium-settings';
import { DEFAULT_BRANDING } from '@/lib/condominium-settings';
import { splitCondominiumName } from '@/lib/condominium-display';
import type { AdminSession } from '@/lib/load-admin-session';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

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
  const condoName = session.membership?.condominium_name ?? 'Veka';
  const { line1, line2 } = splitCondominiumName(condoName);

  const panelLabel = session.isAdmin
    ? 'Panel admin'
    : session.canAccessSecurity
      ? 'Caseta'
      : 'Portal residente';

  return (
    <PanelPageHeaderProvider>
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
          <div className="border-b border-white/10 px-4 py-6 text-center">
            <div className="flex flex-col items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-20 w-20 rounded-2xl object-contain" />
              ) : (
                <VekaLogo variant="mark" className="w-20" />
              )}
              <div className="max-w-[12rem]">
                <p className="serif-title text-xl leading-snug text-[var(--text)]">{line1}</p>
                {line2 ? (
                  <p className="serif-title text-lg leading-snug text-muted">{line2}</p>
                ) : null}
              </div>
            </div>
          </div>
          <AdminNav sectionLabel={panelLabel} />
          <div className="mt-auto border-t border-white/10 px-4 py-4">
            <VekaLogo variant="stacked" className="mx-auto w-full max-w-[9.5rem]" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar
            session={session}
            avatarUrl={avatarUrl}
            initials={initials}
            displayName={displayName}
            isPlatformAdmin={isPlatformAdmin}
          />

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
    </PanelPageHeaderProvider>
  );
}
