import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function linkPostToAssembly(
  supabase: Supabase,
  condominiumId: string,
  assemblyId: string,
  postId: string,
): Promise<{ error?: string }> {
  const id = assemblyId.trim();
  const pid = postId.trim();
  if (!id || !pid) return { error: 'Asamblea o publicación no válida.' };

  const { data: assembly } = await supabase
    .from('assemblies')
    .select('id')
    .eq('id', id)
    .eq('condominium_id', condominiumId)
    .maybeSingle();
  if (!assembly) return { error: 'Asamblea no encontrada.' };

  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', pid)
    .eq('condominium_id', condominiumId)
    .maybeSingle();
  if (!post) return { error: 'Publicación no encontrada.' };

  const { error } = await supabase.from('assembly_posts').upsert(
    { assembly_id: id, post_id: pid },
    { onConflict: 'assembly_id,post_id' },
  );
  if (error) return { error: error.message };
  return {};
}

export async function linkPostToAssemblyFromForm(
  supabase: Supabase,
  condominiumId: string,
  formData: FormData,
  postId: string,
): Promise<{ error?: string }> {
  const assemblyId = String(formData.get('assembly_id') ?? '').trim();
  if (!assemblyId) return {};
  return linkPostToAssembly(supabase, condominiumId, assemblyId, postId);
}
