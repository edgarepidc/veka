import { useCallback, useEffect, useRef, useState } from 'react';

import { canVoteInPoll, formatCommunityAuthorName, isDelinquentCharge, isPollClosed, STORAGE_BUCKETS, type ClusterRef } from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';
import { useAuth } from '@/providers/AuthProvider';

export interface CommunityPost {
  id: string;
  title: string;
  body: string | null;
  post_type: 'announcement' | 'poll' | 'photo';
  is_pinned: boolean;
  image_url: string | null;
  is_formal: boolean;
  require_payment_current: boolean;
  quorum_percent: number | null;
  poll_closes_at: string | null;
  poll_closed_at: string | null;
  created_at: string;
  author_id: string;
  author_name: string;
  author_initials: string;
  author_color: string;
  reactions: Record<string, number>;
  myReactions: string[];
  pollOptions?: { id: string; label: string; votes: number }[];
  myVote?: string | null;
  eligibleVoters: number;
  comments: PostComment[];
  clusters: ClusterRef[];
}

export interface PostComment {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
  author_initials: string;
  author_color: string;
}

export interface CommunityDocument {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
  clusters: ClusterRef[];
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

async function resolvePostImageUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  const { data } = await supabase.storage.from(STORAGE_BUCKETS.POSTS).createSignedUrl(imageUrl, 3600);
  return data?.signedUrl ?? imageUrl;
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

    const [postsRes, docsRes, debt, eligibleFormalRes, eligibleInformalRes] = await Promise.all([
      supabase
        .from('posts')
        .select(
          'id, title, body, post_type, image_url, is_pinned, is_formal, require_payment_current, quorum_percent, poll_closes_at, poll_closed_at, created_at, author_id',
        )
        .eq('condominium_id', primary.condominium_id)
        .eq('is_archived', false)
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
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'active')
        .not('unit_id', 'is', null)
        .or('unit_relationship.is.null,unit_relationship.eq.owner'),
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'active')
        .not('unit_id', 'is', null),
    ]);

    const eligibleFormal = eligibleFormalRes.count ?? 0;
    const eligibleInformal = eligibleInformalRes.count ?? 0;

    setHasOutstandingDebt(debt);

    const rawPosts = postsRes.data ?? [];
    const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];
    const [profilesRes, authorMembershipsRes] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', authorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      authorIds.length
        ? supabase
            .from('memberships')
            .select('user_id, role')
            .eq('condominium_id', primary.condominium_id)
            .eq('status', 'active')
            .in('user_id', authorIds)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    ]);

    const roleMap = new Map(
      (authorMembershipsRes.data ?? []).map((membership) => [membership.user_id, membership.role]),
    );
    const profileMap = new Map(
      (profilesRes.data ?? []).map((profile) => [
        profile.id,
        formatCommunityAuthorName(profile.full_name, roleMap.get(profile.id)),
      ]),
    );
    for (const authorId of authorIds) {
      if (!profileMap.has(authorId)) {
        profileMap.set(authorId, formatCommunityAuthorName(null, roleMap.get(authorId)));
      }
    }
    const postIds = rawPosts.map((p) => p.id);
    const commentPostIds = rawPosts
      .filter((post) => post.post_type === 'announcement' || post.post_type === 'photo')
      .map((post) => post.id);

    const [reactionsRes, pollOptionsRes, commentsRes, postClustersRes] = await Promise.all([
      postIds.length
        ? supabase.from('post_reactions').select('post_id, emoji, user_id').in('post_id', postIds)
        : Promise.resolve({ data: [] as { post_id: string; emoji: string; user_id: string }[] }),
      postIds.length
        ? supabase.from('poll_options').select('id, post_id, label').in('post_id', postIds)
        : Promise.resolve({ data: [] as { id: string; post_id: string; label: string }[] }),
      commentPostIds.length
        ? supabase
            .from('post_comments')
            .select('id, post_id, body, created_at, author_id')
            .in('post_id', commentPostIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as { id: string; post_id: string; body: string; created_at: string; author_id: string }[] }),
      postIds.length
        ? supabase
            .from('post_clusters')
            .select('post_id, cluster_id, cluster:clusters(name)')
            .in('post_id', postIds)
        : Promise.resolve({
            data: [] as {
              post_id: string;
              cluster_id: string;
              cluster: { name: string } | { name: string }[] | null;
            }[],
          }),
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

    const commentAuthorIds = [...new Set((commentsRes.data ?? []).map((comment) => comment.author_id))];
    const missingAuthorIds = commentAuthorIds.filter((id) => !profileMap.has(id));
    if (missingAuthorIds.length > 0) {
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', missingAuthorIds);
      const { data: commentMemberships } = await supabase
        .from('memberships')
        .select('user_id, role')
        .eq('condominium_id', primary.condominium_id)
        .eq('status', 'active')
        .in('user_id', missingAuthorIds);

      const commentRoleMap = new Map(
        (commentMemberships ?? []).map((membership) => [membership.user_id, membership.role]),
      );
      for (const profile of commentProfiles ?? []) {
        profileMap.set(
          profile.id,
          formatCommunityAuthorName(profile.full_name, commentRoleMap.get(profile.id)),
        );
      }
    }

    const commentsByPost = new Map<string, PostComment[]>();
    for (const comment of commentsRes.data ?? []) {
      const authorName = profileMap.get(comment.author_id) ?? 'Residente';
      const mapped: PostComment = {
        id: comment.id,
        post_id: comment.post_id,
        body: comment.body,
        created_at: comment.created_at,
        author_id: comment.author_id,
        author_name: authorName,
        author_initials: initials(authorName),
        author_color: authorColor(comment.author_id),
      };
      const list = commentsByPost.get(comment.post_id) ?? [];
      list.push(mapped);
      commentsByPost.set(comment.post_id, list);
    }

    const clustersByPost = new Map<string, ClusterRef[]>();
    for (const row of postClustersRes.data ?? []) {
      const clusterRaw = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
      const name = clusterRaw?.name ?? 'Torre';
      const list = clustersByPost.get(row.post_id) ?? [];
      list.push({ id: row.cluster_id, name });
      clustersByPost.set(row.post_id, list);
    }

    const mappedPosts: CommunityPost[] = await Promise.all(
      rawPosts.map(async (post) => {
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
      const imageUrl = post.image_url ? await resolvePostImageUrl(post.image_url) : null;

      return {
        id: post.id,
        title: post.title,
        body: post.body,
        post_type: post.post_type,
        is_pinned: post.is_pinned,
        image_url: imageUrl,
        is_formal: post.is_formal ?? true,
        require_payment_current: post.require_payment_current ?? false,
        quorum_percent: post.quorum_percent != null ? Number(post.quorum_percent) : null,
        poll_closes_at: post.poll_closes_at ?? null,
        poll_closed_at: post.poll_closed_at ?? null,
        created_at: post.created_at,
        author_id: post.author_id,
        author_name: name,
        author_initials: initials(name),
        author_color: authorColor(post.author_id),
        reactions,
        myReactions,
        pollOptions,
        myVote: voted?.id ?? null,
        eligibleVoters: (post.is_formal ?? true) ? eligibleFormal : eligibleInformal,
        comments: commentsByPost.get(post.id) ?? [],
        clusters: clustersByPost.get(post.id) ?? [],
      };
    }),
    );

    setPosts(mappedPosts);

    const rawDocs = (docsRes.data ?? []) as Omit<CommunityDocument, 'clusters'>[];
    const documentIds = rawDocs.map((doc) => doc.id);
    const { data: documentClusters } = documentIds.length
      ? await supabase
          .from('document_clusters')
          .select('document_id, cluster_id, cluster:clusters(name)')
          .in('document_id', documentIds)
      : { data: [] as { document_id: string; cluster_id: string; cluster: { name: string } | { name: string }[] | null }[] };

    const clustersByDocument = new Map<string, ClusterRef[]>();
    for (const row of documentClusters ?? []) {
      const clusterRaw = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
      const name = clusterRaw?.name ?? 'Torre';
      const list = clustersByDocument.get(row.document_id) ?? [];
      list.push({ id: row.cluster_id, name });
      clustersByDocument.set(row.document_id, list);
    }

    const resolvedDocs = await Promise.all(
      rawDocs.map(async (doc) => ({
        ...doc,
        file_url: await resolveDocumentUrl(doc.file_url),
        clusters: clustersByDocument.get(doc.id) ?? [],
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
                if (row.user_id === user?.id && post.myReactions.includes(row.emoji!)) {
                  return post;
                }
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
              if (row.user_id === user?.id && post.myVote === row.poll_option_id) {
                return post;
              }
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments' },
        (payload) => {
          const row = payload.new as {
            id?: string;
            post_id?: string;
            body?: string;
            created_at?: string;
            author_id?: string;
          };
          if (!row.id || !row.post_id || !row.body || !row.created_at || !row.author_id) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== row.post_id) return post;
              if (post.comments.some((comment) => comment.id === row.id)) return post;
              const authorName = row.author_id === user?.id ? 'Tú' : 'Residente';
              return {
                ...post,
                comments: [
                  ...post.comments,
                  {
                    id: row.id!,
                    post_id: row.post_id!,
                    body: row.body!,
                    created_at: row.created_at!,
                    author_id: row.author_id!,
                    author_name: authorName,
                    author_initials: initials(authorName),
                    author_color: authorColor(row.author_id!),
                  },
                ],
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
      if (isPollClosed(post)) return { error: 'Esta encuesta ya está cerrada.' };
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

  const addComment = useCallback(
    async (postId: string, body: string): Promise<{ error?: string }> => {
      if (!user) return { error: 'Inicia sesión para comentar.' };
      const trimmed = body.trim();
      if (!trimmed) return { error: 'Escribe un comentario.' };

      const post = posts.find((item) => item.id === postId);
      if (!post || (post.post_type !== 'announcement' && post.post_type !== 'photo')) {
        return { error: 'Solo puedes comentar en avisos.' };
      }

      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, author_id: user.id, body: trimmed })
        .select('id, post_id, body, created_at, author_id')
        .single();

      if (error || !data) return { error: 'No se pudo publicar el comentario.' };

      const mapped: PostComment = {
        id: data.id,
        post_id: data.post_id,
        body: data.body,
        created_at: data.created_at,
        author_id: data.author_id,
        author_name: 'Tú',
        author_initials: initials('Tú'),
        author_color: authorColor(data.author_id),
      };

      setPosts((current) =>
        current.map((item) => {
          if (item.id !== postId) return item;
          if (item.comments.some((comment) => comment.id === mapped.id)) return item;
          return { ...item, comments: [...item.comments, mapped] };
        }),
      );

      return {};
    },
    [posts, user],
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
    addComment,
    canVoteFormalPolls,
    canVoteInPost,
    hasOutstandingDebt,
  };
}
