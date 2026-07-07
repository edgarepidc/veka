import { NextResponse } from 'next/server';

import { acceptPendingInvitations } from '@/lib/accept-invitations';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadPlatformSession } from '@/lib/platform-admin';
import { panelHomePath } from '@/lib/route-access';

export async function GET() {
  await acceptPendingInvitations();

  const platform = await loadPlatformSession();
  if (platform) {
    return NextResponse.json({ path: '/platform' });
  }

  const session = await loadAdminSession();
  if (!session) {
    return NextResponse.json({ path: '/login' });
  }

  if (session.condominiums.length === 0) {
    return NextResponse.json({ path: '/onboarding' });
  }

  if (session.isAdmin) {
    return NextResponse.json({ path: '/' });
  }

  return NextResponse.json({
    path: panelHomePath({
      isAdmin: session.isAdmin,
      canAccessSecurity: session.canAccessSecurity,
    }),
  });
}
