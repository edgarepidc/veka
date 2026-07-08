'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { deliverCommunityPost } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';

function formatPublishMessage(base: string, pushSent: number): string {
  if (pushSent <= 0) return base;
  return `${base} Notificación enviada a ${pushSent} dispositivo${pushSent === 1 ? '' : 's'}.`;
}

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

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      condominium_id: condominiumId,
      author_id: user.id,
      post_type: 'announcement',
      title,
      body: body || null,
      is_pinned: isPinned,
      is_formal: false,
      is_admin_only: false,
      require_payment_current: false,
    })
    .select('id')
    .single();

  if (error || !post) return { error: error?.message ?? 'No se pudo publicar el aviso.' };

  const delivery = await deliverCommunityPost({
    condominiumId,
    postId: post.id,
    title,
    body: body || null,
    postType: 'announcement',
    isPinned,
  });

  revalidatePath('/comunidad');
  return { success: true, message: formatPublishMessage('Aviso publicado.', delivery.pushSent) };
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
  return { success: true, message: 'Documento publicado.' };
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
  const requirePaymentCurrent = formData.get('require_payment_current') === 'on';
  const pollClosesAtRaw = String(formData.get('poll_closes_at') ?? '').trim();

  const options = optionsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!title) return { error: 'Título obligatorio.' };
  if (options.length < 2) return { error: 'Agrega al menos dos opciones de respuesta.' };

  let pollClosesAt: string | null = null;
  if (pollClosesAtRaw) {
    const parsed = new Date(pollClosesAtRaw);
    if (Number.isNaN(parsed.getTime())) return { error: 'Fecha de cierre inválida.' };
    if (parsed.getTime() <= Date.now()) return { error: 'La fecha de cierre debe ser futura.' };
    pollClosesAt = parsed.toISOString();
  }

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
      require_payment_current: requirePaymentCurrent,
      poll_closes_at: pollClosesAt,
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

  const delivery = await deliverCommunityPost({
    condominiumId,
    postId: post.id,
    title,
    body: body || null,
    postType: 'poll',
    isPinned,
  });

  revalidatePath('/comunidad');
  return { success: true, message: formatPublishMessage('Encuesta publicada.', delivery.pushSent) };
}

export async function closePoll(postId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, post_type, poll_closed_at')
    .eq('id', postId)
    .eq('condominium_id', condominiumId)
    .single();

  if (fetchError || !post) return { error: 'Encuesta no encontrada.' };
  if (post.post_type !== 'poll') return { error: 'Solo aplica a encuestas.' };
  if (post.poll_closed_at) return { error: 'La encuesta ya está cerrada.' };

  const { error } = await supabase
    .from('posts')
    .update({ poll_closed_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true, message: 'Encuesta cerrada. Ya no se aceptan votos.' };
}
