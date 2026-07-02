'use server';

import { redirect } from 'next/navigation';

import { assertPlatformAdminAction } from '@/lib/require-platform-admin';
import {
  clearImpersonationCookies,
  setImpersonationCookies,
} from '@/lib/impersonation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function platformStartImpersonation(condominiumId: string) {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  if (!condominiumId) return { error: 'Condominio inválido.' };

  const admin = createAdminClient();
  const { data: condo } = await admin
    .from('condominiums')
    .select('id')
    .eq('id', condominiumId)
    .maybeSingle();

  if (!condo) return { error: 'Condominio no encontrado.' };

  await setImpersonationCookies(condominiumId);
  redirect('/');
}

export async function platformStopImpersonation() {
  const denied = await assertPlatformAdminAction();
  if (denied) return denied;

  await clearImpersonationCookies();
  redirect('/platform');
}
