import { NextResponse } from 'next/server';

import { loadAdminSession } from '@/lib/load-admin-session';
import { loadPlatformSession } from '@/lib/platform-admin';

export async function GET() {
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

  return NextResponse.json({ path: '/mi-cuenta' });
}
