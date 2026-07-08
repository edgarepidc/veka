'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export async function createAnnouncement(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const isPinned = formData.get('is_pinned') === 'on';

  if (!title) return { error: 'Título obligatorio.' };

  const { error } = await supabase.from('posts').insert({
    condominium_id: condominiumId,
    author_id: user.id,
    post_type: 'announcement',
    title,
    body: body || null,
    is_pinned: isPinned,
    is_formal: false,
    is_admin_only: false,
  });

  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true };
}

export async function uploadDocument(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();

  if (!title) return { error: 'Título obligatorio.' };
  if (!category) return { error: 'Categoría obligatoria.' };
  if (!fileUrl) return { error: 'Sube el documento (PDF o imagen).' };

  const { error } = await supabase.from('documents').insert({
    id: randomUUID(),
    condominium_id: condominiumId,
    title,
    category,
    file_url: fileUrl,
    uploaded_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true };
}

export async function createPoll(formData: FormData) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const optionsRaw = String(formData.get('options') ?? '');
  const isFormal = formData.get('is_formal') !== 'off';
  const isPinned = formData.get('is_pinned') === 'on';

  const options = optionsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!title) return { error: 'Título obligatorio.' };
  if (options.length < 2) return { error: 'Agrega al menos dos opciones de respuesta.' };

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      condominium_id: condominiumId,
      author_id: user.id,
      post_type: 'poll',
      title,
      body: body || null,
      is_pinned: isPinned,
      is_formal: isFormal,
      is_admin_only: false,
    })
    .select('id')
    .single();

  if (postError || !post) return { error: postError?.message ?? 'No se pudo crear la encuesta.' };

  const { error: optionsError } = await supabase.from('poll_options').insert(
    options.map((label) => ({
      post_id: post.id,
      label,
    })),
  );

  if (optionsError) return { error: optionsError.message };

  revalidatePath('/comunidad');
  return { success: true };
}
