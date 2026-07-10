import {
  ASSEMBLY_STATUS_LABELS,
  isAssemblyStatus,
  isTicketDoneStatus,
  type AssemblyStatus,
  type ClusterRef,
} from '@veka/shared';

import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface AssemblyLinkedPost {
  id: string;
  title: string;
  postType: 'announcement' | 'poll' | 'photo';
  createdAt: string;
}

export interface AssemblyLinkedDocument {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  createdAt: string;
}

export interface AssemblyAgreementRow {
  id: string;
  title: string;
  sortOrder: number;
  isDone: boolean;
  ticketId: string | null;
  ticketTitle: string | null;
  ticketStatus: string | null;
}

export interface AssemblyRow {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: AssemblyStatus;
  statusLabel: string;
  notes: string | null;
  createdAt: string;
  clusters: ClusterRef[];
  posts: AssemblyLinkedPost[];
  documents: AssemblyLinkedDocument[];
  agreements: AssemblyAgreementRow[];
}

export interface AssemblyTicketOption {
  id: string;
  title: string;
  status: string;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function loadAssemblies(condominiumId?: string): Promise<AssemblyRow[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('assemblies')
    .select(
      `
      id, title, scheduled_at, status, notes, created_at,
      assembly_clusters(cluster:clusters(id, name)),
      assembly_posts(post:posts(id, title, post_type, created_at)),
      assembly_documents(document:documents(id, title, category, file_url, created_at)),
      assembly_agreements(id, title, sort_order, is_done, ticket_id, ticket:maintenance_tickets(id, title, status))
    `,
    )
    .eq('condominium_id', condoId)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Record<string, unknown>[];

  return rows.map((row) => {
    const statusRaw = String(row.status ?? 'draft');
    const status: AssemblyStatus = isAssemblyStatus(statusRaw) ? statusRaw : 'draft';

    const clusterLinks = asArray(row.assembly_clusters as { cluster: ClusterRef | ClusterRef[] | null }[]);
    const clusters = clusterLinks
      .map((link) => {
        const cluster = Array.isArray(link.cluster) ? link.cluster[0] : link.cluster;
        return cluster ? { id: cluster.id, name: cluster.name } : null;
      })
      .filter((item): item is ClusterRef => Boolean(item));

    const postLinks = asArray(
      row.assembly_posts as {
        post:
          | { id: string; title: string; post_type: string; created_at: string }
          | { id: string; title: string; post_type: string; created_at: string }[]
          | null;
      }[],
    );
    const posts = postLinks
      .map((link) => {
        const post = Array.isArray(link.post) ? link.post[0] : link.post;
        if (!post) return null;
        const postType =
          post.post_type === 'poll' || post.post_type === 'photo' ? post.post_type : 'announcement';
        return {
          id: post.id,
          title: post.title,
          postType,
          createdAt: post.created_at,
        } satisfies AssemblyLinkedPost;
      })
      .filter((item): item is AssemblyLinkedPost => Boolean(item));

    const documentLinks = asArray(
      row.assembly_documents as {
        document:
          | { id: string; title: string; category: string; file_url: string; created_at: string }
          | { id: string; title: string; category: string; file_url: string; created_at: string }[]
          | null;
      }[],
    );
    const documents = documentLinks
      .map((link) => {
        const document = Array.isArray(link.document) ? link.document[0] : link.document;
        if (!document) return null;
        return {
          id: document.id,
          title: document.title,
          category: document.category,
          fileUrl: document.file_url,
          createdAt: document.created_at,
        } satisfies AssemblyLinkedDocument;
      })
      .filter((item): item is AssemblyLinkedDocument => Boolean(item));

    const agreementRows = asArray(
      row.assembly_agreements as {
        id: string;
        title: string;
        sort_order: number;
        is_done: boolean;
        ticket_id: string | null;
        ticket:
          | { id: string; title: string; status: string }
          | { id: string; title: string; status: string }[]
          | null;
      }[],
    );

    const agreements = agreementRows
      .map((agreement) => {
        const ticket = Array.isArray(agreement.ticket) ? agreement.ticket[0] : agreement.ticket;
        const ticketStatus = ticket?.status ?? null;
        const doneFromTicket = isTicketDoneStatus(ticketStatus);
        return {
          id: agreement.id,
          title: agreement.title,
          sortOrder: agreement.sort_order ?? 0,
          isDone: Boolean(agreement.is_done) || doneFromTicket,
          ticketId: agreement.ticket_id,
          ticketTitle: ticket?.title ?? null,
          ticketStatus,
        } satisfies AssemblyAgreementRow;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'es'));

    return {
      id: String(row.id),
      title: String(row.title ?? 'Asamblea'),
      scheduledAt: (row.scheduled_at as string | null) ?? null,
      status,
      statusLabel: ASSEMBLY_STATUS_LABELS[status],
      notes: (row.notes as string | null) ?? null,
      createdAt: String(row.created_at),
      clusters,
      posts,
      documents,
      agreements,
    };
  });
}

export async function loadAssemblyTicketOptions(
  condominiumId?: string,
): Promise<AssemblyTicketOption[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const { data } = await supabase
    .from('maintenance_tickets')
    .select('id, title, status')
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
  }));
}
