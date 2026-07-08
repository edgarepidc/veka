import type { SupabaseClient } from '@supabase/supabase-js';

import { parseClusterIdsFromFormData } from '@veka/shared';

import { createClient } from '@/lib/supabase/server';

export interface ClusterOption {
  id: string;
  name: string;
}

export async function loadCondominiumClusters(condominiumId: string): Promise<ClusterOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clusters')
    .select('id, name')
    .eq('condominium_id', condominiumId)
    .order('name', { ascending: true });

  return (data ?? []) as ClusterOption[];
}

export function readClusterIdsFromForm(formData: FormData): string[] {
  return parseClusterIdsFromFormData(formData);
}

export function resolveClusterScopeFromForm(formData: FormData): {
  clusterIds: string[];
  error?: string;
} {
  const mode = String(formData.get('scope_mode') ?? 'all');
  const clusterIds = readClusterIdsFromForm(formData);
  if (mode === 'clusters' && clusterIds.length === 0) {
    return {
      clusterIds: [],
      error: 'Selecciona al menos una torre o marca todo el fraccionamiento.',
    };
  }
  return { clusterIds: mode === 'all' ? [] : clusterIds };
}

export async function validateClusterIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  condominiumId: string,
  clusterIds: string[],
): Promise<{ error?: string }> {
  if (clusterIds.length === 0) return {};

  const { data } = await supabase
    .from('clusters')
    .select('id')
    .eq('condominium_id', condominiumId)
    .in('id', clusterIds);

  if ((data ?? []).length !== clusterIds.length) {
    return { error: 'Una o más torres seleccionadas no son válidas.' };
  }

  return {};
}

export async function attachPostClusters(
  supabase: SupabaseClient,
  postId: string,
  clusterIds: string[],
): Promise<{ error?: string }> {
  if (clusterIds.length === 0) return {};

  const { error } = await supabase.from('post_clusters').insert(
    clusterIds.map((clusterId) => ({
      post_id: postId,
      cluster_id: clusterId,
    })),
  );

  if (error) return { error: error.message };
  return {};
}

export async function attachDocumentClusters(
  supabase: SupabaseClient,
  documentId: string,
  clusterIds: string[],
): Promise<{ error?: string }> {
  if (clusterIds.length === 0) return {};

  const { error } = await supabase.from('document_clusters').insert(
    clusterIds.map((clusterId) => ({
      document_id: documentId,
      cluster_id: clusterId,
    })),
  );

  if (error) return { error: error.message };
  return {};
}
