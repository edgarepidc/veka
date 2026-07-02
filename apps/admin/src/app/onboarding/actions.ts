'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACTIVE_CONDO_COOKIE } from '@/lib/condominium-context';
import { createCondominiumWithOrganization } from '@/lib/create-condominium';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createCondominiumOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const admin = createAdminClient();
  const result = await createCondominiumWithOrganization(admin, {
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    timezone: String(formData.get('timezone') ?? 'America/Mexico_City'),
  });

  if ('error' in result) return result;

  const { error: membershipError } = await admin.from('memberships').insert({
    user_id: user.id,
    condominium_id: result.condominiumId,
    role: 'super_admin',
    status: 'active',
  });

  if (membershipError) {
    return { error: membershipError.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CONDO_COOKIE, result.condominiumId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect('/configuracion/unidades');
}
