'use server';

import { revalidatePath } from 'next/cache';
import { isAssemblyStatus, type AssemblyStatus } from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

function revalidateCommunity() {
  revalidatePath('/comunidad');
}

async function requireAdminCondo(formCondoId?: string) {
  const condoResult = await requireActiveCondominiumId(formCondoId);
  if (typeof condoResult !== 'string') return { error: condoResult.error } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' } as const;
  return { condominiumId: condoResult, supabase, user } as const;
}

async function assertAssemblyInCondo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assemblyId: string,
  condominiumId: string,
) {
  const { data } = await supabase
    .from('assemblies')
    .select('id')
    .eq('id', assemblyId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();
  return Boolean(data);
}

export async function createAssembly(formData: FormData) {
  const auth = await requireAdminCondo(String(formData.get('condominium_id') ?? ''));
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase, user } = auth;

  const title = String(formData.get('title') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'draft');
  const scheduledRaw = String(formData.get('scheduled_at') ?? '').trim();
  const clusterId = String(formData.get('cluster_id') ?? '').trim();

  if (!title) return { error: 'Indica el título de la asamblea.' };
  const status: AssemblyStatus = isAssemblyStatus(statusRaw) ? statusRaw : 'draft';
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;
  if (scheduledRaw && Number.isNaN(Date.parse(scheduledRaw))) {
    return { error: 'Fecha de asamblea inválida.' };
  }

  const { data: created, error } = await supabase
    .from('assemblies')
    .insert({
      condominium_id: condominiumId,
      title,
      notes: notes || null,
      status,
      scheduled_at: scheduledAt,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (clusterId) {
    const { error: clusterError } = await supabase.from('assembly_clusters').insert({
      assembly_id: created.id,
      cluster_id: clusterId,
    });
    if (clusterError) return { error: clusterError.message };
  }

  revalidateCommunity();
  return { success: true, id: created.id as string };
}

export async function updateAssembly(formData: FormData) {
  const auth = await requireAdminCondo(String(formData.get('condominium_id') ?? ''));
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const assemblyId = String(formData.get('assembly_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'draft');
  const scheduledRaw = String(formData.get('scheduled_at') ?? '').trim();

  if (!assemblyId) return { error: 'Asamblea no válida.' };
  if (!title) return { error: 'Indica el título de la asamblea.' };
  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  const status: AssemblyStatus = isAssemblyStatus(statusRaw) ? statusRaw : 'draft';
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;
  if (scheduledRaw && Number.isNaN(Date.parse(scheduledRaw))) {
    return { error: 'Fecha de asamblea inválida.' };
  }

  const { error } = await supabase
    .from('assemblies')
    .update({
      title,
      notes: notes || null,
      status,
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assemblyId)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function deleteAssembly(assemblyId: string) {
  const auth = await requireAdminCondo();
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const id = assemblyId.trim();
  if (!id) return { error: 'Asamblea no válida.' };

  const { error } = await supabase
    .from('assemblies')
    .delete()
    .eq('id', id)
    .eq('condominium_id', condominiumId);

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function linkAssemblyPost(formData: FormData) {
  const auth = await requireAdminCondo(String(formData.get('condominium_id') ?? ''));
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const assemblyId = String(formData.get('assembly_id') ?? '').trim();
  const postId = String(formData.get('post_id') ?? '').trim();
  if (!assemblyId || !postId) return { error: 'Selecciona un aviso o encuesta.' };
  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();
  if (!post) return { error: 'Publicación no encontrada.' };

  const { error } = await supabase.from('assembly_posts').upsert(
    { assembly_id: assemblyId, post_id: postId },
    { onConflict: 'assembly_id,post_id' },
  );
  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function unlinkAssemblyPost(assemblyId: string, postId: string) {
  const auth = await requireAdminCondo();
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  const { error } = await supabase
    .from('assembly_posts')
    .delete()
    .eq('assembly_id', assemblyId)
    .eq('post_id', postId);

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function linkAssemblyDocument(formData: FormData) {
  const auth = await requireAdminCondo(String(formData.get('condominium_id') ?? ''));
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const assemblyId = String(formData.get('assembly_id') ?? '').trim();
  const documentId = String(formData.get('document_id') ?? '').trim();
  if (!assemblyId || !documentId) return { error: 'Selecciona un documento.' };
  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  const { data: document } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('condominium_id', condominiumId)
    .maybeSingle();
  if (!document) return { error: 'Documento no encontrado.' };

  const { error } = await supabase.from('assembly_documents').upsert(
    { assembly_id: assemblyId, document_id: documentId },
    { onConflict: 'assembly_id,document_id' },
  );
  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function unlinkAssemblyDocument(assemblyId: string, documentId: string) {
  const auth = await requireAdminCondo();
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  const { error } = await supabase
    .from('assembly_documents')
    .delete()
    .eq('assembly_id', assemblyId)
    .eq('document_id', documentId);

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function addAssemblyAgreement(formData: FormData) {
  const auth = await requireAdminCondo(String(formData.get('condominium_id') ?? ''));
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const assemblyId = String(formData.get('assembly_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const ticketId = String(formData.get('ticket_id') ?? '').trim() || null;

  if (!assemblyId) return { error: 'Asamblea no válida.' };
  if (!title) return { error: 'Describe el acuerdo.' };
  if (!(await assertAssemblyInCondo(supabase, assemblyId, condominiumId))) {
    return { error: 'Asamblea no encontrada.' };
  }

  if (ticketId) {
    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('condominium_id', condominiumId)
      .maybeSingle();
    if (!ticket) return { error: 'Ticket no encontrado.' };
  }

  const { data: existing } = await supabase
    .from('assembly_agreements')
    .select('sort_order')
    .eq('assembly_id', assemblyId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('assembly_agreements').insert({
    assembly_id: assemblyId,
    title,
    ticket_id: ticketId,
    sort_order: nextOrder,
    is_done: false,
  });

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function toggleAssemblyAgreement(agreementId: string, isDone: boolean) {
  const auth = await requireAdminCondo();
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const id = agreementId.trim();
  if (!id) return { error: 'Acuerdo no válido.' };

  const { data: agreement } = await supabase
    .from('assembly_agreements')
    .select('id, assembly:assemblies(condominium_id)')
    .eq('id', id)
    .maybeSingle();

  const assembly = Array.isArray(agreement?.assembly) ? agreement?.assembly[0] : agreement?.assembly;
  if (!agreement || assembly?.condominium_id !== condominiumId) {
    return { error: 'Acuerdo no encontrado.' };
  }

  const { error } = await supabase
    .from('assembly_agreements')
    .update({ is_done: isDone })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}

export async function removeAssemblyAgreement(agreementId: string) {
  const auth = await requireAdminCondo();
  if ('error' in auth) return { error: auth.error };
  const { condominiumId, supabase } = auth;

  const id = agreementId.trim();
  if (!id) return { error: 'Acuerdo no válido.' };

  const { data: agreement } = await supabase
    .from('assembly_agreements')
    .select('id, assembly:assemblies(condominium_id)')
    .eq('id', id)
    .maybeSingle();

  const assembly = Array.isArray(agreement?.assembly) ? agreement?.assembly[0] : agreement?.assembly;
  if (!agreement || assembly?.condominium_id !== condominiumId) {
    return { error: 'Acuerdo no encontrado.' };
  }

  const { error } = await supabase.from('assembly_agreements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidateCommunity();
  return { success: true };
}
