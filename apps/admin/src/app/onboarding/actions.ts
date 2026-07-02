'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACTIVE_CONDO_COOKIE, slugifyCondominiumName } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function uniqueSlug(base: string, suffix: string): string {
  const slug = slugifyCondominiumName(base);
  return `${slug || 'condominio'}-${suffix}`.slice(0, 60);
}

export async function createCondominiumOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? 'America/Mexico_City').trim() || 'America/Mexico_City';

  if (!name) return { error: 'El nombre del condominio es obligatorio.' };

  const suffix = crypto.randomUUID().slice(0, 8);
  const orgSlug = uniqueSlug(name, suffix);
  const condoSlug = uniqueSlug(name, suffix);

  const admin = createAdminClient();

  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .insert({ name, slug: orgSlug })
    .select('id')
    .single();

  if (orgError || !organization) {
    return { error: orgError?.message ?? 'No se pudo crear la organización.' };
  }

  const { data: condominium, error: condoError } = await admin
    .from('condominiums')
    .insert({
      organization_id: organization.id,
      name,
      slug: condoSlug,
      address: address || null,
      timezone,
      settings: {},
    })
    .select('id')
    .single();

  if (condoError || !condominium) {
    return { error: condoError?.message ?? 'No se pudo crear el condominio.' };
  }

  const { error: membershipError } = await admin.from('memberships').insert({
    user_id: user.id,
    condominium_id: condominium.id,
    role: 'super_admin',
    status: 'active',
  });

  if (membershipError) {
    return { error: membershipError.message };
  }

  await admin.from('fund_balances').upsert(
    [
      { condominium_id: condominium.id, fund_type: 'operating', balance: 0, opening_balance: 0 },
      { condominium_id: condominium.id, fund_type: 'reserve', balance: 0, opening_balance: 0 },
    ],
    { onConflict: 'condominium_id,fund_type' },
  );

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CONDO_COOKIE, condominium.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect('/configuracion/unidades');
}
