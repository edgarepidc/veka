import { cookies } from 'next/headers';

import { ACTIVE_CONDO_COOKIE } from '@/lib/condominium-context';

export const IMPERSONATE_CONDO_COOKIE = 'veka_impersonate_condo_id';

export async function readImpersonationCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(IMPERSONATE_CONDO_COOKIE)?.value?.trim();
  return value || null;
}

export async function setImpersonationCookies(condominiumId: string) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  cookieStore.set(IMPERSONATE_CONDO_COOKIE, condominiumId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  cookieStore.set(ACTIVE_CONDO_COOKIE, condominiumId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearImpersonationCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_CONDO_COOKIE);
}
