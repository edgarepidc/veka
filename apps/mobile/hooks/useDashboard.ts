import { useCallback, useEffect, useState } from 'react';

import {
  chargeBalanceDue,
  chargeDisplaySubtitle,
  chargeDisplayTitle,
  chargeStatusLabel,
  chargeStatusTone,
  formatCurrency,
  resolveNextPaymentTarget,
  resolveStorageImageUrl,
  STORAGE_BUCKETS,
  unitTotalBalanceDue,
  type ActivePaymentPlan,
  type FeeSourceRef,
} from '@veka/shared';

import { supabase } from '@/lib/supabase';
import type { ActiveMembership } from '@/hooks/useMembership';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export interface DashboardNextPayment {
  label: string;
  concept: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'overdue';
  fee_campaign: FeeSourceRef | null;
  recurring_fee: FeeSourceRef | null;
  isInstallment: boolean;
}

function normalizeFeeSource(raw: unknown): FeeSourceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as FeeSourceRef & { cluster?: { name: string } | { name: string }[] | null };
  const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
  return { ...row, cluster: cluster ?? null };
}

export interface DashboardPollOption {
  label: string;
  votes: number;
}

export interface DashboardPost {
  id: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  created_at: string;
  post_type: 'announcement' | 'poll' | 'photo';
  image_url: string | null;
  pollOptions: DashboardPollOption[];
}

export interface DashboardReservation {
  id: string;
  starts_at: string;
  ends_at: string;
  amenity_name: string;
  amenity_image_url: string | null;
  status: 'confirmed' | 'pending';
}

export interface DashboardPackage {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  received_at: string;
  photo_url: string | null;
}

export interface DashboardData {
  nextPayment: DashboardNextPayment | null;
  latestPost: DashboardPost | null;
  upcomingReservations: DashboardReservation[];
  pendingPackage: DashboardPackage | null;
  balanceDue: number;
  paidThisMonth: number;
  openTicketCount: number;
  chargeBars: { label: string; value: number }[];
}

const EMPTY: DashboardData = {
  nextPayment: null,
  latestPost: null,
  upcomingReservations: [],
  pendingPackage: null,
  balanceDue: 0,
  paidThisMonth: 0,
  openTicketCount: 0,
  chargeBars: [],
};

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function monthStartIso(reference = new Date()): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}-01`;
}

async function resolvePrivateImageUrl(bucket: string, pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(pathOrUrl, 3600);
  return data?.signedUrl ?? null;
}

export function useDashboard(primary: ActiveMembership | null) {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();
    const monthStart = monthStartIso();

    const [chargesRes, planRes, postsRes, reservationsRes, packagesRes, paymentsRes, ticketsRes] =
      await Promise.all([
        supabase
          .from('charges')
          .select(
            'id, concept, amount, amount_paid, due_date, status, charge_kind, parent_charge_id, fee_campaign:fee_campaigns(scope, concept, amount, cluster:clusters(name)), recurring_fee:recurring_fees(scope, concept, cluster:clusters(name))',
          )
          .eq('unit_id', primary.unit_id)
          .order('due_date', { ascending: true }),
        supabase
          .from('payment_plans')
          .select(
            'id, title, status, total_amount, installments:payment_plan_installments(id, installment_number, due_date, amount, amount_paid, status), charge_links:payment_plan_charges(charge_id)',
          )
          .eq('unit_id', primary.unit_id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('posts')
          .select('id, title, body, is_pinned, created_at, post_type, image_url')
          .eq('condominium_id', primary.condominium_id)
          .eq('is_archived', false)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('reservations')
          .select('id, starts_at, ends_at, status, amenity:amenities (name, image_url)')
          .eq('unit_id', primary.unit_id)
          .in('status', ['confirmed', 'pending'])
          .gte('ends_at', now)
          .order('starts_at', { ascending: true })
          .limit(4),
        supabase
          .from('packages')
          .select('id, carrier, tracking_number, received_at, photo_url')
          .eq('unit_id', primary.unit_id)
          .eq('status', 'received')
          .order('received_at', { ascending: false })
          .limit(1),
        supabase
          .from('payments')
          .select('amount, status, paid_at')
          .eq('unit_id', primary.unit_id)
          .eq('status', 'approved')
          .gte('paid_at', monthStart),
        supabase
          .from('maintenance_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', primary.unit_id)
          .in('status', ['open', 'in_progress']),
      ]);

    const rawCharges =
      ((chargesRes.data as {
        id: string;
        concept: string;
        amount: number;
        amount_paid?: number;
        due_date: string;
        status: string;
        charge_kind?: string;
        parent_charge_id?: string | null;
        fee_campaign?: unknown;
        recurring_fee?: unknown;
      }[]) ?? []).map((charge) => ({
        id: charge.id,
        concept: charge.concept,
        amount: Number(charge.amount),
        amount_paid: Number(charge.amount_paid ?? 0),
        due_date: charge.due_date,
        status: charge.status,
        charge_kind: charge.charge_kind ?? 'principal',
        parent_charge_id: charge.parent_charge_id ?? null,
        fee_campaign: normalizeFeeSource(charge.fee_campaign),
        recurring_fee: normalizeFeeSource(charge.recurring_fee),
      }));

    const planRow = planRes.data as {
      id: string;
      title: string;
      status: string;
      total_amount: number;
      installments: ActivePaymentPlan['installments'];
      charge_links: { charge_id: string }[];
    } | null;

    const activePlan: ActivePaymentPlan | null = planRow
      ? {
          id: planRow.id,
          title: planRow.title,
          status: planRow.status,
          total_amount: Number(planRow.total_amount),
          installments: (planRow.installments ?? []).map((row) => ({
            ...row,
            amount: Number(row.amount),
            amount_paid: Number(row.amount_paid ?? 0),
          })),
          linked_charge_ids: (planRow.charge_links ?? []).map((link) => link.charge_id),
        }
      : null;

    const paymentTarget = resolveNextPaymentTarget(rawCharges, activePlan);
    const primaryCharge = paymentTarget
      ? rawCharges.find((charge) => charge.id === paymentTarget.chargeId)
      : null;

    const reservationRows =
      (reservationsRes.data as
        | {
            id: string;
            starts_at: string;
            ends_at: string;
            status: 'confirmed' | 'pending';
            amenity:
              | { name: string; image_url: string | null }
              | { name: string; image_url: string | null }[]
              | null;
          }[]
        | null) ?? [];

    const upcomingReservations: DashboardReservation[] = reservationRows.map((row) => {
      const amenity = Array.isArray(row.amenity) ? row.amenity[0] : row.amenity;
      return {
        id: row.id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        amenity_name: amenity?.name ?? 'Espacio',
        amenity_image_url: resolveStorageImageUrl(
          SUPABASE_URL,
          amenity?.image_url,
          STORAGE_BUCKETS.AMENITY_IMAGES,
        ),
        status: row.status,
      };
    });

    const packageRow = packagesRes.data?.[0] as
      | {
          id: string;
          carrier: string | null;
          tracking_number: string | null;
          received_at: string;
          photo_url: string | null;
        }
      | undefined;

    const postRow = postsRes.data?.[0] as
      | {
          id: string;
          title: string;
          body: string | null;
          is_pinned: boolean;
          created_at: string;
          post_type: 'announcement' | 'poll' | 'photo';
          image_url: string | null;
        }
      | undefined;

    let pollOptions: DashboardPollOption[] = [];
    if (postRow?.post_type === 'poll') {
      const { data: options } = await supabase
        .from('poll_options')
        .select('id, label')
        .eq('post_id', postRow.id);
      const optionIds = (options ?? []).map((opt) => opt.id);
      const { data: votes } = optionIds.length
        ? await supabase.from('poll_votes').select('poll_option_id').in('poll_option_id', optionIds)
        : { data: [] as { poll_option_id: string }[] };
      const counts = new Map<string, number>();
      for (const vote of votes ?? []) {
        counts.set(vote.poll_option_id, (counts.get(vote.poll_option_id) ?? 0) + 1);
      }
      pollOptions = (options ?? []).map((opt) => ({
        label: opt.label,
        votes: counts.get(opt.id) ?? 0,
      }));
    }

    const [packagePhoto, postImage] = await Promise.all([
      resolvePrivateImageUrl(STORAGE_BUCKETS.PACKAGES, packageRow?.photo_url ?? null),
      resolvePrivateImageUrl(STORAGE_BUCKETS.POSTS, postRow?.image_url ?? null),
    ]);

    const unpaid = rawCharges
      .filter((charge) => charge.status === 'pending' || charge.status === 'overdue')
      .slice(0, 4)
      .map((charge) => ({
        label: charge.concept.slice(0, 18),
        value: chargeBalanceDue(charge),
      }));

    const paidThisMonth = (paymentsRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    setData({
      nextPayment: paymentTarget
        ? {
            label: paymentTarget.label,
            concept: primaryCharge?.concept ?? paymentTarget.label,
            amount: paymentTarget.maxAmount,
            due_date: paymentTarget.dueDate,
            status: primaryCharge?.status === 'overdue' ? 'overdue' : 'pending',
            fee_campaign: primaryCharge?.fee_campaign ?? null,
            recurring_fee: primaryCharge?.recurring_fee ?? null,
            isInstallment: paymentTarget.kind === 'installment',
          }
        : null,
      latestPost: postRow
        ? {
            id: postRow.id,
            title: postRow.title,
            body: postRow.body,
            is_pinned: postRow.is_pinned,
            created_at: postRow.created_at,
            post_type: postRow.post_type,
            image_url: postImage,
            pollOptions,
          }
        : null,
      upcomingReservations,
      pendingPackage: packageRow
        ? {
            id: packageRow.id,
            carrier: packageRow.carrier,
            tracking_number: packageRow.tracking_number,
            received_at: packageRow.received_at,
            photo_url: packagePhoto,
          }
        : null,
      balanceDue: unitTotalBalanceDue(rawCharges),
      paidThisMonth,
      openTicketCount: ticketsRes.count ?? 0,
      chargeBars: unpaid,
    });
    setLoading(false);
  }, [primary]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    refresh,
    formatShortDate,
    formatDateTime,
    chargeStatusLabel,
    chargeStatusTone,
    chargeDisplayTitle,
    chargeDisplaySubtitle,
    formatCurrency,
  };
}
