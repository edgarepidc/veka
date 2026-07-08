import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface CommunityPollOptionRow {
  id: string;
  label: string;
  votes: number;
}

export interface CommunityCommentRow {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_id: string;
}

export interface CommunityPostRow {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  image_url: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  archived_at: string | null;
  is_formal: boolean;
  require_payment_current: boolean;
  quorum_percent: number | null;
  poll_closes_at: string | null;
  poll_closed_at: string | null;
  created_at: string;
  poll_options: CommunityPollOptionRow[];
  total_votes: number;
  eligible_voters: number;
  comments: CommunityCommentRow[];
}

export interface CommunityDocumentRow {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

async function countEligibleVoters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  condominiumId: string,
  isFormal: boolean,
): Promise<number> {
  let query = supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .not('unit_id', 'is', null);

  if (isFormal) {
    query = query.or('unit_relationship.is.null,unit_relationship.eq.owner');
  }

  const { count } = await query;
  return count ?? 0;
}

export async function loadCommunityPosts(condominiumId?: string): Promise<CommunityPostRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('posts')
    .select(
      'id, title, body, post_type, image_url, is_pinned, is_archived, archived_at, is_formal, require_payment_current, quorum_percent, poll_closes_at, poll_closed_at, created_at, poll_options(id, label)',
    )
    .eq('condominium_id', condoId)
    .order('is_archived', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = data ?? [];
  const postIds = rows.map((row) => row.id);
  const announcementIds = rows
    .filter((row) => row.post_type === 'announcement' || row.post_type === 'photo')
    .map((row) => row.id);

  const optionIds = rows.flatMap((row) =>
    (Array.isArray(row.poll_options) ? row.poll_options : []).map((opt: { id: string }) => opt.id),
  );

  const [votesRes, commentsRes, eligibleFormal, eligibleInformal] = await Promise.all([
    optionIds.length > 0
      ? supabase.from('poll_votes').select('poll_option_id').in('poll_option_id', optionIds)
      : Promise.resolve({ data: [] as { poll_option_id: string }[] }),
    announcementIds.length > 0
      ? supabase
          .from('post_comments')
          .select('id, post_id, body, created_at, author_id')
          .in('post_id', announcementIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as CommunityCommentRow[] }),
    countEligibleVoters(supabase, condoId, true),
    countEligibleVoters(supabase, condoId, false),
  ]);

  const voteCounts = new Map<string, number>();
  for (const vote of votesRes.data ?? []) {
    const optionId = vote.poll_option_id as string;
    voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1);
  }

  const commentsByPost = new Map<string, CommunityCommentRow[]>();
  for (const comment of commentsRes.data ?? []) {
    const list = commentsByPost.get(comment.post_id) ?? [];
    list.push(comment as CommunityCommentRow);
    commentsByPost.set(comment.post_id, list);
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
    const isFormal = row.is_formal ?? true;

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      post_type: row.post_type as CommunityPostRow['post_type'],
      image_url: row.image_url ?? null,
      is_pinned: row.is_pinned,
      is_archived: row.is_archived ?? false,
      archived_at: row.archived_at ?? null,
      is_formal: isFormal,
      require_payment_current: row.require_payment_current ?? false,
      quorum_percent: row.quorum_percent != null ? Number(row.quorum_percent) : null,
      poll_closes_at: row.poll_closes_at ?? null,
      poll_closed_at: row.poll_closed_at ?? null,
      created_at: row.created_at,
      poll_options: pollOptions,
      total_votes: totalVotes,
      eligible_voters: isFormal ? eligibleFormal : eligibleInformal,
      comments: commentsByPost.get(row.id) ?? [],
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
