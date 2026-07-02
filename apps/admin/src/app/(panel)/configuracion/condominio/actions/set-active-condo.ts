'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { ACTIVE_CONDO_COOKIE, userCanAccessCondominium } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export async function setActiveCondominium(condominiumId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const allowed = await userCanAccessCondominium(user.id, condominiumId);
  if (!allowed) return { error: 'No tienes acceso a ese condominio.' };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CONDO_COOKIE, condominiumId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
