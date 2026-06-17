import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface CommunityPost {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
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

export function useCommunity(primary: ActiveMembership | null) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [documents, setDocuments] = useState<CommunityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!primary?.condominium_id) {
      setPosts([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const [postsRes, docsRes] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, body, post_type, is_pinned, created_at, author_id')
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
    ]);

    const rawPosts = postsRes.data ?? [];
    const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];
    const { data: profiles } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Residente']));
    const postIds = rawPosts.map((p) => p.id);

    const [reactionsRes, pollOptionsRes, votesRes] = await Promise.all([
      postIds.length
        ? supabase.from('post_reactions').select('post_id, emoji, user_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as { post_id: string; emoji: string; user_id: string }[] }),
      postIds.length
        ? supabase.from('poll_options').select('id, post_id, label').in('post_id', postIds)
        : Promise.resolve({ data: [] as { id: string; post_id: string; label: string }[] }),
      postIds.length
        ? supabase.from('poll_votes').select('poll_option_id, user_id')
        : Promise.resolve({ data: [] as { poll_option_id: string; user_id: string }[] }),
    ]);

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
    setDocuments((docsRes.data as CommunityDocument[]) ?? []);
    setLoading(false);
  }, [primary?.condominium_id, user?.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      if (!user) return;
      const existing = posts.find((p) => p.id === postId)?.myReactions.includes(emoji);
      if (existing) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('emoji', emoji);
      } else {
        await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, emoji });
      }
      await refresh();
    },
    [posts, refresh, user],
  );

  const votePoll = useCallback(
    async (postId: string, optionId: string) => {
      if (!user) return;
      const post = posts.find((p) => p.id === postId);
      if (!post?.pollOptions || post.myVote) return;
      await supabase.from('poll_votes').insert({ poll_option_id: optionId, user_id: user.id });
      await refresh();
    },
    [posts, refresh, user],
  );

  return { posts, documents, loading, refreshing, refresh, toggleReaction, votePoll };
}
