import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export interface CommunityPostRow {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
  is_formal: boolean;
  created_at: string;
  poll_options: { id: string; label: string }[];
}

export async function loadCommunityPosts(): Promise<CommunityPostRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('posts')
    .select('id, title, body, post_type, is_pinned, is_formal, created_at, poll_options(id, label)')
    .eq('condominium_id', DEMO_CONDO_ID)
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
    created_at: row.created_at,
    poll_options: (Array.isArray(row.poll_options) ? row.poll_options : []) as { id: string; label: string }[],
  }));
}
