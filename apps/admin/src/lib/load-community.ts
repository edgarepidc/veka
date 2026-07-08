import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface CommunityPostRow {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
  is_formal: boolean;
  require_payment_current: boolean;
  created_at: string;
  poll_options: { id: string; label: string }[];
}

export interface CommunityDocumentRow {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

export async function loadCommunityPosts(condominiumId?: string): Promise<CommunityPostRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('posts')
    .select('id, title, body, post_type, is_pinned, is_formal, require_payment_current, created_at, poll_options(id, label)')
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: false })
    .limit(30);

  const rows = data ?? [];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    post_type: row.post_type as CommunityPostRow['post_type'],
    is_pinned: row.is_pinned,
    is_formal: row.is_formal ?? true,
    require_payment_current: row.require_payment_current ?? false,
    created_at: row.created_at,
    poll_options: (Array.isArray(row.poll_options) ? row.poll_options : []) as { id: string; label: string }[],
  }));
}

export async function loadCommunityDocuments(condominiumId?: string): Promise<CommunityDocumentRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('documents')
    .select('id, title, category, file_url, created_at')
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: false })
    .limit(30);

  return (data ?? []) as CommunityDocumentRow[];
}
