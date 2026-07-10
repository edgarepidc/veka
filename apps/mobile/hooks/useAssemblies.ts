import { useCallback, useEffect, useState } from 'react';
import {
  ASSEMBLY_STATUS_LABELS,
  isAssemblyStatus,
  isTicketDoneStatus,
  type AssemblyStatus,
  type ClusterRef,
} from '@veka/shared';

import type { ActiveMembership } from '@/hooks/useMembership';
import { supabase } from '@/lib/supabase';

export interface AssemblyLinkedPostItem {
  id: string;
  title: string;
  postType: string;
  body: string | null;
  imageUrl: string | null;
  isFormal: boolean;
  quorumPercent: number | null;
  pollClosesAt: string | null;
  pollClosedAt: string | null;
  pollOptions: { id: string; label: string; votes: number }[];
  totalVotes: number;
}

export interface AssemblyListItem {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: AssemblyStatus;
  statusLabel: string;
  notes: string | null;
  clusters: ClusterRef[];
  posts: AssemblyLinkedPostItem[];
  documents: { id: string; title: string; fileUrl: string }[];
  agreements: {
    id: string;
    title: string;
    isDone: boolean;
    ticketTitle: string | null;
    ticketStatus: string | null;
  }[];
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function enrichAssemblyPosts(
  rows: Record<string, unknown>[],
): Promise<Map<string, AssemblyLinkedPostItem>> {
  const postIds = new Set<string>();
  for (const row of rows) {
    for (const link of asArray(
      row.assembly_posts as { post: { id: string } | { id: string }[] | null }[],
    )) {
      const post = Array.isArray(link.post) ? link.post[0] : link.post;
      if (post?.id) postIds.add(post.id);
    }
  }

  if (postIds.size === 0) return new Map();

  const { data } = await supabase
    .from('posts')
    .select(
      'id, title, body, post_type, image_url, is_formal, quorum_percent, poll_closes_at, poll_closed_at, poll_options(id, label)',
    )
    .in('id', Array.from(postIds));

  const optionIds = (data ?? []).flatMap((row) =>
    asArray(row.poll_options as { id: string }[]).map((opt) => opt.id),
  );

  const { data: votes } =
    optionIds.length > 0
      ? await supabase.from('poll_votes').select('poll_option_id').in('poll_option_id', optionIds)
      : { data: [] as { poll_option_id: string }[] };

  const voteCounts = new Map<string, number>();
  for (const vote of votes ?? []) {
    voteCounts.set(vote.poll_option_id, (voteCounts.get(vote.poll_option_id) ?? 0) + 1);
  }

  const map = new Map<string, AssemblyLinkedPostItem>();
  for (const row of data ?? []) {
    const pollOptions = asArray(row.poll_options as { id: string; label: string }[]).map((opt) => ({
      id: opt.id,
      label: opt.label,
      votes: voteCounts.get(opt.id) ?? 0,
    }));
    const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);
    map.set(row.id, {
      id: row.id,
      title: row.title,
      postType: row.post_type,
      body: row.body ?? null,
      imageUrl: row.image_url ?? null,
      isFormal: Boolean(row.is_formal),
      quorumPercent: row.quorum_percent != null ? Number(row.quorum_percent) : null,
      pollClosesAt: row.poll_closes_at ?? null,
      pollClosedAt: row.poll_closed_at ?? null,
      pollOptions,
      totalVotes,
    });
  }
  return map;
}

export function useAssemblies(primary: ActiveMembership | null) {
  const [assemblies, setAssemblies] = useState<AssemblyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!primary?.condominium_id) {
      setAssemblies([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);

    const { data } = await supabase
      .from('assemblies')
      .select(
        `
        id, title, scheduled_at, status, notes,
        assembly_clusters(cluster:clusters(id, name)),
        assembly_posts(post:posts(id)),
        assembly_documents(document:documents(id, title, file_url)),
        assembly_agreements(id, title, sort_order, is_done, ticket:maintenance_tickets(title, status))
      `,
      )
      .eq('condominium_id', primary.condominium_id)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const rawRows = (data ?? []) as Record<string, unknown>[];
    const postsById = await enrichAssemblyPosts(rawRows);
    const memberClusterId = primary.unit?.cluster?.id ?? null;

    const rows = rawRows.map((row) => {
      const statusRaw = String(row.status ?? 'draft');
      const status: AssemblyStatus = isAssemblyStatus(statusRaw) ? statusRaw : 'draft';

      const clusters = asArray(row.assembly_clusters as { cluster: ClusterRef | ClusterRef[] | null }[])
        .map((link) => {
          const cluster = Array.isArray(link.cluster) ? link.cluster[0] : link.cluster;
          return cluster ? { id: cluster.id, name: cluster.name } : null;
        })
        .filter((item): item is ClusterRef => Boolean(item));

      const posts = asArray(
        row.assembly_posts as { post: { id: string } | { id: string }[] | null }[],
      )
        .map((link) => {
          const post = Array.isArray(link.post) ? link.post[0] : link.post;
          if (!post?.id) return null;
          return postsById.get(post.id) ?? null;
        })
        .filter((item): item is AssemblyLinkedPostItem => Boolean(item));

      const documents = asArray(
        row.assembly_documents as {
          document:
            | { id: string; title: string; file_url: string }
            | { id: string; title: string; file_url: string }[]
            | null;
        }[],
      )
        .map((link) => {
          const document = Array.isArray(link.document) ? link.document[0] : link.document;
          if (!document) return null;
          return { id: document.id, title: document.title, fileUrl: document.file_url };
        })
        .filter((item): item is { id: string; title: string; fileUrl: string } => Boolean(item));

      const agreements = asArray(
        row.assembly_agreements as {
          id: string;
          title: string;
          sort_order: number;
          is_done: boolean;
          ticket: { title: string; status: string } | { title: string; status: string }[] | null;
        }[],
      )
        .map((agreement) => {
          const ticket = Array.isArray(agreement.ticket) ? agreement.ticket[0] : agreement.ticket;
          return {
            id: agreement.id,
            title: agreement.title,
            isDone: Boolean(agreement.is_done) || isTicketDoneStatus(ticket?.status),
            ticketTitle: ticket?.title ?? null,
            ticketStatus: ticket?.status ?? null,
            sortOrder: agreement.sort_order ?? 0,
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ sortOrder: _sortOrder, ...rest }) => rest);

      return {
        id: String(row.id),
        title: String(row.title ?? 'Asamblea'),
        scheduledAt: (row.scheduled_at as string | null) ?? null,
        status,
        statusLabel: ASSEMBLY_STATUS_LABELS[status],
        notes: (row.notes as string | null) ?? null,
        clusters,
        posts,
        documents,
        agreements,
      } satisfies AssemblyListItem;
    });

    setAssemblies(
      rows.filter((assembly) => {
        if (assembly.clusters.length === 0) return true;
        if (!memberClusterId) return true;
        return assembly.clusters.some((cluster) => cluster.id === memberClusterId);
      }),
    );
    setLoading(false);
    setRefreshing(false);
  }, [primary?.condominium_id, primary?.unit?.cluster?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { assemblies, loading, refreshing, refresh };
}
