'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { notifyCondoMembersInApp } from '@/lib/community-notifications';
import { deliverCommunityPollClosed, deliverCommunityPost } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { formatPollMinutesExport, isPollClosed } from '@veka/shared';

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
  const attachmentUrl = String(formData.get('attachment_url') ?? '').trim();
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
      image_url: attachmentUrl || null,
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
    excludeUserId: user.id,
  });

  await notifyCondoMembersInApp({
    condominiumId,
    notificationType: 'community_announcement',
    title: isPinned ? 'Nuevo aviso importante' : 'Nuevo aviso',
    body: title,
    entityId: post.id,
    excludeUserId: user.id,
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
  const quorumPercentRaw = String(formData.get('quorum_percent') ?? '').trim();

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

  let quorumPercent: number | null = null;
  if (quorumPercentRaw) {
    const parsed = Number(quorumPercentRaw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
      return { error: 'El quórum debe ser un porcentaje entre 1 y 100.' };
    }
    if (!isFormal) return { error: 'El quórum solo aplica a encuestas formales.' };
    quorumPercent = parsed;
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
      quorum_percent: quorumPercent,
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
    excludeUserId: user.id,
  });

  await notifyCondoMembersInApp({
    condominiumId,
    notificationType: 'community_poll',
    title: 'Nueva encuesta',
    body: title,
    entityId: post.id,
    excludeUserId: user.id,
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
    .select('id, title, post_type, poll_closed_at')
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

  await notifyCondoMembersInApp({
    condominiumId,
    notificationType: 'community_poll_closed',
    title: 'Encuesta cerrada',
    body: post.title,
    entityId: postId,
  });

  await deliverCommunityPollClosed({
    condominiumId,
    postId,
    title: post.title,
  });

  revalidatePath('/comunidad');
  return { success: true, message: 'Encuesta cerrada. Ya no se aceptan votos.' };
}

export async function unpinPost(postId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: false })
    .eq('id', postId)
    .eq('condominium_id', condoResult);

  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true, message: 'Publicación desfijada.' };
}

export async function archivePost(postId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('posts')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      is_pinned: false,
    })
    .eq('id', postId)
    .eq('condominium_id', condoResult);

  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true, message: 'Publicación archivada. Ya no aparece en la app.' };
}

export async function deleteComment(commentId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };

  const supabase = await createClient();
  const { data: comment, error: fetchError } = await supabase
    .from('post_comments')
    .select('id, post_id')
    .eq('id', commentId)
    .single();

  if (fetchError || !comment) return { error: 'Comentario no encontrado.' };

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('condominium_id')
    .eq('id', comment.post_id)
    .single();

  if (postError || !post) return { error: 'Publicación no encontrada.' };
  if (post.condominium_id !== condoResult) return { error: 'No autorizado.' };

  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  if (error) return { error: error.message };

  revalidatePath('/comunidad');
  return { success: true, message: 'Comentario eliminado.' };
}

export async function exportPollResults(postId: string) {
  const condoResult = await requireActiveCondominiumId();
  if (typeof condoResult !== 'string') return { error: condoResult.error };

  const supabase = await createClient();
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select(
      'id, title, body, is_formal, quorum_percent, poll_closes_at, poll_closed_at, created_at, post_type, poll_options(id, label)',
    )
    .eq('id', postId)
    .eq('condominium_id', condoResult)
    .single();

  if (fetchError || !post) return { error: 'Encuesta no encontrada.' };
  if (post.post_type !== 'poll') return { error: 'Solo aplica a encuestas.' };
  if (!isPollClosed(post)) return { error: 'Cierra la encuesta antes de exportar el acta.' };

  const options = (Array.isArray(post.poll_options) ? post.poll_options : []) as { id: string; label: string }[];
  const optionIds = options.map((opt) => opt.id);

  const { data: votes } = optionIds.length
    ? await supabase.from('poll_votes').select('poll_option_id').in('poll_option_id', optionIds)
    : { data: [] as { poll_option_id: string }[] };

  const voteCounts = new Map<string, number>();
  for (const vote of votes ?? []) {
    voteCounts.set(vote.poll_option_id, (voteCounts.get(vote.poll_option_id) ?? 0) + 1);
  }

  const pollOptions = options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    votes: voteCounts.get(opt.id) ?? 0,
  }));
  const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);

  let eligibleQuery = supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('condominium_id', condoResult)
    .eq('status', 'active')
    .not('unit_id', 'is', null);

  if (post.is_formal ?? true) {
    eligibleQuery = eligibleQuery.or('unit_relationship.is.null,unit_relationship.eq.owner');
  }

  const { count: eligibleVoters } = await eligibleQuery;

  const text = formatPollMinutesExport({
    title: post.title,
    body: post.body,
    isFormal: post.is_formal ?? true,
    createdAt: post.created_at,
    pollClosesAt: post.poll_closes_at,
    pollClosedAt: post.poll_closed_at,
    quorumPercent: post.quorum_percent != null ? Number(post.quorum_percent) : null,
    options: pollOptions,
    totalVotes,
    eligibleVoters: eligibleVoters ?? 0,
  });

  return { success: true, text };
}
