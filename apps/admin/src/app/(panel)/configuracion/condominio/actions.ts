'use server';

import { revalidatePath } from 'next/cache';

import { DEMO_CONDO_ID } from '@/lib/constants';
import {
  DEFAULT_BRANDING,
  parseCondominiumSettings,
  type CondominiumSettings,
} from '@/lib/condominium-settings';
import { assertAdminAction } from '@/lib/require-admin';
import { createClient } from '@/lib/supabase/server';

export async function updateCondominium(formData: FormData) {
  const denied = await assertAdminAction();
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const address = String(formData.get('address') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? 'America/Mexico_City');
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const primaryColor = String(formData.get('primary_color') ?? '').trim();
  const accentColor = String(formData.get('accent_color') ?? '').trim();

  if (!name || !slug) {
    return { error: 'Nombre y slug son obligatorios.' };
  }

  const { data: existing } = await supabase
    .from('condominiums')
    .select('settings')
    .eq('id', DEMO_CONDO_ID)
    .maybeSingle();

  const currentSettings = parseCondominiumSettings(existing?.settings);
  const branding = {
    logo_url: logoUrl || undefined,
    primary_color: primaryColor || DEFAULT_BRANDING.primary_color,
    accent_color: accentColor || DEFAULT_BRANDING.accent_color,
  };

  const settings: CondominiumSettings = {
    ...currentSettings,
    branding,
  };

  const { error } = await supabase
    .from('condominiums')
    .update({
      name,
      slug,
      address: address || null,
      timezone,
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', DEMO_CONDO_ID);

  if (error) return { error: error.message };

  revalidatePath('/configuracion/condominio');
  revalidatePath('/');
  return { success: true };
}
