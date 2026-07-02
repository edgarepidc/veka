import type { SupabaseClient } from '@supabase/supabase-js';

import { slugifyCondominiumName } from '@/lib/condominium-context';

function uniqueSlug(base: string, suffix: string): string {
  const slug = slugifyCondominiumName(base);
  return `${slug || 'condominio'}-${suffix}`.slice(0, 60);
}

export interface CreateCondominiumInput {
  name: string;
  address?: string | null;
  timezone?: string;
  organizationName?: string | null;
}

export interface CreateCondominiumResult {
  organizationId: string;
  condominiumId: string;
  condominiumName: string;
  organizationName: string;
}

export async function createCondominiumWithOrganization(
  admin: SupabaseClient,
  input: CreateCondominiumInput,
): Promise<CreateCondominiumResult | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: 'El nombre del condominio es obligatorio.' };

  const organizationName = (input.organizationName?.trim() || name).trim();
  const timezone = input.timezone?.trim() || 'America/Mexico_City';
  const suffix = crypto.randomUUID().slice(0, 8);
  const orgSlug = uniqueSlug(organizationName, suffix);
  const condoSlug = uniqueSlug(name, suffix);

  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .insert({ name: organizationName, slug: orgSlug })
    .select('id, name')
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
      address: input.address?.trim() || null,
      timezone,
      settings: {},
    })
    .select('id, name')
    .single();

  if (condoError || !condominium) {
    return { error: condoError?.message ?? 'No se pudo crear el condominio.' };
  }

  await admin.from('fund_balances').upsert(
    [
      { condominium_id: condominium.id, fund_type: 'operating', balance: 0, opening_balance: 0 },
      { condominium_id: condominium.id, fund_type: 'reserve', balance: 0, opening_balance: 0 },
    ],
    { onConflict: 'condominium_id,fund_type' },
  );

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    condominiumId: condominium.id,
    condominiumName: condominium.name,
  };
}
