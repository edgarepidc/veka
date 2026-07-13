'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export async function updateAdminProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado' };
  }

  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const avatarUrl = String(formData.get('avatar_url') ?? '').trim();
  const showPhoneInDirectory = formData.get('show_phone_in_directory') === 'true';

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: fullName || null,
        phone: phone || null,
        avatar_url: avatarUrl || null,
        show_phone_in_directory: showPhoneInDirectory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id')
    .single();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: 'No se pudo guardar el perfil.' };
  }

  revalidatePath('/configuracion');
  revalidatePath('/configuracion/perfil');
  revalidatePath('/comunidad');
  revalidatePath('/');
  return { success: true };
}

export async function updateAdminPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado' };
  }

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
