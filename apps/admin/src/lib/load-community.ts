import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface CommunityPollOptionRow {
  id: string;
  label: string;
  votes: number;
}

export interface CommunityPostRow {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
  is_formal: boolean;
  require_payment_current: boolean;
  poll_closes_at: string | null;
  poll_closed_at: string | null;
  created_at: string;
  poll_options: CommunityPollOptionRow[];
  total_votes: number;
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
    .select(
      'id, title, body, post_type, is_pinned, is_formal, require_payment_current, poll_closes_at, poll_closed_at, created_at, poll_options(id, label)',
    )
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: false })
    .limit(30);

  const rows = data ?? [];
  const optionIds = rows.flatMap((row) =>
    (Array.isArray(row.poll_options) ? row.poll_options : []).map((opt: { id: string }) => opt.id),
  );

  const voteCounts = new Map<string, number>();
  if (optionIds.length > 0) {
    const { data: votes } = await supabase.from('poll_votes').select('poll_option_id').in('poll_option_id', optionIds);
    for (const vote of votes ?? []) {
      const optionId = vote.poll_option_id as string;
      voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const pollOptions = (Array.isArray(row.poll_options) ? row.poll_options : []).map(
      (opt: { id: string; label: string }) => ({
        id: opt.id,
        label: opt.label,
        votes: voteCounts.get(opt.id) ?? 0,
      }),
    );
    const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      post_type: row.post_type as CommunityPostRow['post_type'],
      is_pinned: row.is_pinned,
      is_formal: row.is_formal ?? true,
      require_payment_current: row.require_payment_current ?? false,
      poll_closes_at: row.poll_closes_at ?? null,
      poll_closed_at: row.poll_closed_at ?? null,
      created_at: row.created_at,
      poll_options: pollOptions,
      total_votes: totalVotes,
    };
  });
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
