import { redirect } from 'next/navigation';

import { loadPlatformSession, type PlatformSession } from '@/lib/platform-admin';

export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const session = await loadPlatformSession();
  if (!session) redirect('/login?error=platform_denied');
  return session;
}

export async function assertPlatformAdminAction(): Promise<{ error: string } | null> {
  const session = await loadPlatformSession();
  if (!session) return { error: 'Sin permisos de plataforma' };
  return null;
}
