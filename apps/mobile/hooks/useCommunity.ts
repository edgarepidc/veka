import { useCallback, useEffect, useRef, useState } from 'react';

import { canVoteInPoll, isDelinquentCharge, STORAGE_BUCKETS } from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface CommunityPost {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
  is_formal: boolean;
  require_payment_current: boolean;
  created_at: string;
  author_id: string;
  author_name: string;
  author_initials: string;
  author_color: string;
  reactions: Record<string, number>;
  myReactions: string[];
  pollOptions?: { id: string; label: string; votes: number }[];
  myVote?: string | null;
}

export interface CommunityDocument {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

const AUTHOR_COLORS = ['#34d399', '#38bdf8', '#fb923c', '#a78bfa', '#f87171'];

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function authorColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AUTHOR_COLORS.length;
  return AUTHOR_COLORS[hash] ?? AUTHOR_COLORS[0];
}

async function resolveDocumentUrl(fileUrl: string): Promise<string> {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  const { data } = await supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).createSignedUrl(fileUrl, 3600);
  return data?.signedUrl ?? fileUrl;
}

async function fetchOutstandingDebt(unitId: string | null | undefined): Promise<boolean> {
  if (!unitId) return false;

  const { data } = await supabase
    .from('charges')
    .select('due_date, status, amount, amount_paid')
    .eq('unit_id', unitId)
    .in('status', ['pending', 'overdue']);

  return (data ?? []).some((charge) => isDelinquentCharge(charge));
}

export function useCommunity(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [documents, setDocuments] = useState<CommunityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasOutstandingDebt, setHasOutstandingDebt] = useState(false);
  const optionPostMapRef = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!primary?.condominium_id) {
      setPosts([]);
      setDocuments([]);
      setHasOutstandingDebt(false);
      setLoading(false);
      return;
    }

    const [postsRes, docsRes, debt] = await Promise.all([
      supabase
        .from('posts')
        .select(
          'id, title, body, post_type, is_pinned, is_formal, require_payment_current, created_at, author_id',
        )
        .eq('condominium_id', primary.condominium_id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('documents')
        .select('id, title, category, file_url, created_at')
        .eq('condominium_id', primary.condominium_id)
        .order('created_at', { ascending: false })
        .limit(20),
      fetchOutstandingDebt(primary.unit_id),
    ]);

    setHasOutstandingDebt(debt);

    const rawPosts = postsRes.data ?? [];
    const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];
    const { data: profiles } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Residente']));
    const postIds = rawPosts.map((p) => p.id);

    const [reactionsRes, pollOptionsRes] = await Promise.all([
      postIds.length
        ? supabase.from('post_reactions').select('post_id, emoji, user_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as { post_id: string; emoji: string; user_id: string }[] }),
      postIds.length
        ? supabase.from('poll_options').select('id, post_id, label').in('post_id', postIds)
        : Promise.resolve({ data: [] as { id: string; post_id: string; label: string }[] }),
    ]);

    const optionIds = (pollOptionsRes.data ?? []).map((opt) => opt.id);
    const optionPostMap = new Map<string, string>();
    for (const opt of pollOptionsRes.data ?? []) {
      optionPostMap.set(opt.id, opt.post_id);
    }
    optionPostMapRef.current = optionPostMap;

    const votesRes = optionIds.length
      ? await supabase.from('poll_votes').select('poll_option_id, user_id').in('poll_option_id', optionIds)
      : { data: [] as { poll_option_id: string; user_id: string }[] };

    const voteCounts = new Map<string, number>();
    for (const vote of votesRes.data ?? []) {
      voteCounts.set(vote.poll_option_id, (voteCounts.get(vote.poll_option_id) ?? 0) + 1);
    }

    const myVotes = new Set(
      (votesRes.data ?? []).filter((v) => v.user_id === user?.id).map((v) => v.poll_option_id),
    );

    const mappedPosts: CommunityPost[] = rawPosts.map((post) => {
      const name = profileMap.get(post.author_id) ?? 'Residente';
      const reactions: Record<string, number> = {};
      const myReactions: string[] = [];
      for (const reaction of reactionsRes.data ?? []) {
        if (reaction.post_id !== post.id) continue;
        reactions[reaction.emoji] = (reactions[reaction.emoji] ?? 0) + 1;
        if (reaction.user_id === user?.id) myReactions.push(reaction.emoji);
      }

      const pollOptions =
        post.post_type === 'poll'
          ? (pollOptionsRes.data ?? [])
              .filter((opt) => opt.post_id === post.id)
              .map((opt) => ({
                id: opt.id,
                label: opt.label,
                votes: voteCounts.get(opt.id) ?? 0,
              }))
          : undefined;

      const voted = pollOptions?.find((opt) => myVotes.has(opt.id));

      return {
        id: post.id,
        title: post.title,
        body: post.body,
        post_type: post.post_type,
        is_pinned: post.is_pinned,
        is_formal: post.is_formal ?? true,
        require_payment_current: post.require_payment_current ?? false,
        created_at: post.created_at,
        author_id: post.author_id,
        author_name: name,
        author_initials: initials(name),
        author_color: authorColor(post.author_id),
        reactions,
        myReactions,
        pollOptions,
        myVote: voted?.id ?? null,
      };
    });

    setPosts(mappedPosts);

    const rawDocs = (docsRes.data as CommunityDocument[]) ?? [];
    const resolvedDocs = await Promise.all(
      rawDocs.map(async (doc) => ({
        ...doc,
        file_url: await resolveDocumentUrl(doc.file_url),
      })),
    );
    setDocuments(resolvedDocs);
    setLoading(false);
  }, [primary?.condominium_id, primary?.unit_id, user?.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!primary?.condominium_id) return;

    const channel = supabase
      .channel(`community-${primary.condominium_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_reactions' },
        (payload) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as {
            post_id?: string;
            emoji?: string;
            user_id?: string;
          };
          if (!row.post_id || !row.emoji || !row.user_id) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== row.post_id) return post;
              const reactions = { ...post.reactions };
              let myReactions = [...post.myReactions];

              if (payload.eventType === 'INSERT') {
                reactions[row.emoji!] = (reactions[row.emoji!] ?? 0) + 1;
                if (row.user_id === user?.id && !myReactions.includes(row.emoji!)) {
                  myReactions.push(row.emoji!);
                }
              } else if (payload.eventType === 'DELETE') {
                const next = Math.max(0, (reactions[row.emoji!] ?? 1) - 1);
                if (next === 0) delete reactions[row.emoji!];
                else reactions[row.emoji!] = next;
                if (row.user_id === user?.id) {
                  myReactions = myReactions.filter((emoji) => emoji !== row.emoji);
                }
              }

              return { ...post, reactions, myReactions };
            }),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const row = payload.new as { poll_option_id?: string; user_id?: string };
          if (!row.poll_option_id) return;

          const postId = optionPostMapRef.current.get(row.poll_option_id);
          if (!postId) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== postId || !post.pollOptions) return post;
              return {
                ...post,
                pollOptions: post.pollOptions.map((opt) =>
                  opt.id === row.poll_option_id ? { ...opt, votes: opt.votes + 1 } : opt,
                ),
                myVote: row.user_id === user?.id ? row.poll_option_id! : post.myVote,
              };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [primary?.condominium_id, user?.id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const canVoteInPost = useCallback(
    (post: CommunityPost) =>
      canVoteInPoll(primary?.unit_relationship ?? null, post.is_formal, {
        requirePaymentCurrent: post.require_payment_current,
        hasOutstandingDebt,
      }),
    [hasOutstandingDebt, primary?.unit_relationship],
  );

  const toggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      if (!user) return;

      const existing = posts.find((p) => p.id === postId)?.myReactions.includes(emoji);

      setPosts((current) =>
        current.map((post) => {
          if (post.id !== postId) return post;
          const reactions = { ...post.reactions };
          let myReactions = [...post.myReactions];

          if (existing) {
            const next = Math.max(0, (reactions[emoji] ?? 1) - 1);
            if (next === 0) delete reactions[emoji];
            else reactions[emoji] = next;
            myReactions = myReactions.filter((value) => value !== emoji);
          } else {
            reactions[emoji] = (reactions[emoji] ?? 0) + 1;
            myReactions.push(emoji);
          }

          return { ...post, reactions, myReactions };
        }),
      );

      if (existing) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('emoji', emoji);
      } else {
        await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, emoji });
      }
    },
    [posts, user],
  );

  const votePoll = useCallback(
    async (postId: string, optionId: string): Promise<{ error?: string }> => {
      if (!user) return { error: 'Inicia sesión para votar.' };

      const post = posts.find((p) => p.id === postId);
      if (!post?.pollOptions || post.myVote) return { error: 'Ya registraste tu voto.' };
      if (!canVoteInPost(post)) {
        return { error: 'No cumples los requisitos para votar en esta encuesta.' };
      }

      const { error } = await supabase.from('poll_votes').insert({ poll_option_id: optionId, user_id: user.id });
      if (error) {
        return { error: 'No se pudo registrar tu voto. Verifica que cumples los requisitos.' };
      }

      setPosts((current) =>
        current.map((item) => {
          if (item.id !== postId || !item.pollOptions) return item;
          return {
            ...item,
            pollOptions: item.pollOptions.map((opt) =>
              opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt,
            ),
            myVote: optionId,
          };
        }),
      );

      return {};
    },
    [canVoteInPost, posts, user],
  );

  const canVoteFormalPolls = canVoteInPoll(primary?.unit_relationship ?? null, true, {
    hasOutstandingDebt,
  });

  return {
    posts,
    documents,
    loading,
    refreshing,
    refresh,
    toggleReaction,
    votePoll,
    canVoteFormalPolls,
    canVoteInPost,
    hasOutstandingDebt,
  };
}
