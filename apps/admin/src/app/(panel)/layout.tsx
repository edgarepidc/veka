import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadCondominium } from '@/lib/load-condominium';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAdminSession();
  if (!session) redirect('/login');

  const condo = await loadCondominium();

  return (
    <AdminShell session={session} branding={condo?.settings.branding}>
      {children}
    </AdminShell>
  );
}
