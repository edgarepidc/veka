import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { SessionProvider } from '@/components/SessionProvider';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadCondominium } from '@/lib/load-condominium';
import { isPlatformAdminUser } from '@/lib/platform-admin';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAdminSession();
  if (!session) redirect('/login');

  if (session.condominiums.length === 0) {
    const isPlatform = await isPlatformAdminUser(session.userId, session.email);
    if (isPlatform) redirect('/platform');
    redirect('/onboarding');
  }

  const condo =
    session.isAdmin && session.activeCondominiumId
      ? await loadCondominium(session.activeCondominiumId)
      : null;

  return (
    <SessionProvider session={session}>
      <AdminShell
        session={session}
        branding={condo?.settings.branding}
        isPlatformAdmin={await isPlatformAdminUser(session.userId, session.email)}
      >
        <AdminRouteGuard>{children}</AdminRouteGuard>
      </AdminShell>
    </SessionProvider>
  );
}
