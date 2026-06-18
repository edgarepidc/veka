import { redirect } from 'next/navigation';

import { loadAdminSession, type AdminSession } from '@/lib/load-admin-session';
import { residentHomePath } from '@/lib/route-access';

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await loadAdminSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect(residentHomePath());
  return session;
}

export async function assertAdminAction(): Promise<{ error: string } | null> {
  const session = await loadAdminSession();
  if (!session) return { error: 'No autorizado' };
  if (!session.isAdmin) return { error: 'Sin permisos de administrador' };
  return null;
}
