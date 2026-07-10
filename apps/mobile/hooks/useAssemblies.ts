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

export interface AssemblyListItem {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: AssemblyStatus;
  statusLabel: string;
  notes: string | null;
  clusters: ClusterRef[];
  posts: { id: string; title: string; postType: string }[];
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
        assembly_posts(post:posts(id, title, post_type)),
        assembly_documents(document:documents(id, title, file_url)),
        assembly_agreements(id, title, sort_order, is_done, ticket:maintenance_tickets(title, status))
      `,
      )
      .eq('condominium_id', primary.condominium_id)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const memberClusterId = primary.unit?.cluster?.id ?? null;

    const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const statusRaw = String(row.status ?? 'draft');
      const status: AssemblyStatus = isAssemblyStatus(statusRaw) ? statusRaw : 'draft';

      const clusters = asArray(row.assembly_clusters as { cluster: ClusterRef | ClusterRef[] | null }[])
        .map((link) => {
          const cluster = Array.isArray(link.cluster) ? link.cluster[0] : link.cluster;
          return cluster ? { id: cluster.id, name: cluster.name } : null;
        })
        .filter((item): item is ClusterRef => Boolean(item));

      const posts = asArray(
        row.assembly_posts as {
          post: { id: string; title: string; post_type: string } | { id: string; title: string; post_type: string }[] | null;
        }[],
      )
        .map((link) => {
          const post = Array.isArray(link.post) ? link.post[0] : link.post;
          if (!post) return null;
          return { id: post.id, title: post.title, postType: post.post_type };
        })
        .filter((item): item is { id: string; title: string; postType: string } => Boolean(item));

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
