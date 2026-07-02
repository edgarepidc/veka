import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { SessionProvider } from '@/components/SessionProvider';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadCondominium } from '@/lib/load-condominium';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAdminSession();
  if (!session) redirect('/login');

  if (session.condominiums.length === 0) {
    redirect('/onboarding');
  }

  const condo =
    session.isAdmin && session.activeCondominiumId
      ? await loadCondominium(session.activeCondominiumId)
      : null;

  return (
    <SessionProvider session={session}>
      <AdminShell session={session} branding={condo?.settings.branding}>
        <AdminRouteGuard>{children}</AdminRouteGuard>
      </AdminShell>
    </SessionProvider>
  );
}
