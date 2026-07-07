import { redirect } from 'next/navigation';

import { loadAdminSession, type AdminSession } from '@/lib/load-admin-session';
import { panelHomePath } from '@/lib/route-access';

export async function requireSecuritySession(): Promise<AdminSession> {
  const session = await loadAdminSession();
  if (!session) redirect('/login');
  if (!session.isAdmin && !session.canAccessSecurity) {
    redirect(panelHomePath(session));
  }
  return session;
}
