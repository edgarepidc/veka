import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { getMemberUserIdsForScope } from '@/lib/community-notifications';

export interface ChargeReminderInput {
  condominiumId: string;
  unitId: string;
  chargeId: string;
  concept: string;
  amount: number;
  dueDate: string;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  source?: 'manual' | 'cron';
  kind?: 'due_soon' | 'overdue' | 'overdue_reminder' | 'manual';
}

export interface ReminderDeliveryResult {
  pushSent: number;
  emailSent: number;
  skipped: number;
  failures: number;
}

const REMINDER_COOLDOWN_DAYS = 7;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

async function getUnitResidentUserIds(supabase: SupabaseClient, unitId: string): Promise<string[]> {
  const { data } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('unit_id', unitId)
    .eq('status', 'active');

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

async function getUserEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

async function getUserPushTokens(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  return (data ?? []).map((row) => row.token as string);
}

async function wasRecentlyNotified(
  admin: SupabaseClient,
  chargeId: string,
  channel: 'push' | 'email',
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - REMINDER_COOLDOWN_DAYS);

  const { data } = await admin
    .from('notification_deliveries')
    .select('id')
    .eq('charge_id', chargeId)
    .eq('channel', channel)
    .eq('status', 'sent')
    .gte('sent_at', since.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function logDelivery(
  admin: SupabaseClient,
  row: {
    condominiumId: string;
    unitId: string | null;
    userId: string | null;
    chargeId?: string | null;
    channel: 'push' | 'email';
    status: 'sent' | 'failed' | 'skipped';
    message: string;
    error?: string;
  },
): Promise<void> {
  await admin.from('notification_deliveries').insert({
    condominium_id: row.condominiumId,
    unit_id: row.unitId,
    user_id: row.userId,
    charge_id: row.chargeId ?? null,
    channel: row.channel,
    status: row.status,
    message: row.message,
    error: row.error ?? null,
  });
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data,
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    return { sent: 0, failed: tokens.length };
  }

  const payload = (await response.json()) as {
    data?: { status?: string }[];
  };

  const results = payload.data ?? [];
  const sent = results.filter((item) => item.status === 'ok').length;
  return { sent, failed: tokens.length - sent };
}

async function sendReminderEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'Veka <recordatorios@vekacondo.com>';

  if (!apiKey) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  return response.ok;
}

export async function deliverChargeReminder(
  input: ChargeReminderInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const notifyPush = input.notifyPush ?? true;
  const notifyEmail = input.notifyEmail ?? true;
  const skipCooldown = input.source === 'manual';

  const kind = input.kind ?? (input.source === 'manual' ? 'manual' : 'overdue_reminder');
  const message =
    kind === 'due_soon'
      ? `Tu cuota vence pronto: ${input.concept} por ${formatCurrency(input.amount)} (vence ${input.dueDate}).`
      : kind === 'overdue'
        ? `Cuota vencida: ${input.concept} por ${formatCurrency(input.amount)} (venció ${input.dueDate}).`
        : `Recordatorio de pago: ${input.concept} por ${formatCurrency(input.amount)} (vence ${input.dueDate}).`;
  const title =
    kind === 'due_soon'
      ? 'Cuota por vencer — Veka'
      : kind === 'overdue'
        ? 'Cuota vencida — Veka'
        : 'Recordatorio de pago — Veka';
  const userIds = await getUnitResidentUserIds(admin, input.unitId);

  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  if (userIds.length === 0) {
    return { pushSent, emailSent, skipped: 1, failures };
  }

  for (const userId of userIds) {
    if (notifyPush) {
      if (!skipCooldown && (await wasRecentlyNotified(admin, input.chargeId, 'push'))) {
        skipped += 1;
      } else {
        const tokens = await getUserPushTokens(admin, userId);
        if (tokens.length === 0) {
          await logDelivery(admin, {
            condominiumId: input.condominiumId,
            unitId: input.unitId,
            userId,
            chargeId: input.chargeId,
            channel: 'push',
            status: 'skipped',
            message,
            error: 'Sin token push registrado',
          });
          skipped += 1;
        } else {
          const result = await sendExpoPush(tokens, title, message, {
            chargeId: input.chargeId,
            screen: 'finance',
          });
          pushSent += result.sent;
          failures += result.failed;
          await logDelivery(admin, {
            condominiumId: input.condominiumId,
            unitId: input.unitId,
            userId,
            chargeId: input.chargeId,
            channel: 'push',
            status: result.sent > 0 ? 'sent' : 'failed',
            message,
            error: result.sent > 0 ? undefined : 'No se pudo entregar push',
          });
        }
      }
    }

    if (notifyEmail) {
      if (!skipCooldown && (await wasRecentlyNotified(admin, input.chargeId, 'email'))) {
        skipped += 1;
      } else {
        const email = await getUserEmail(admin, userId);
        if (!email) {
          await logDelivery(admin, {
            condominiumId: input.condominiumId,
            unitId: input.unitId,
            userId,
            chargeId: input.chargeId,
            channel: 'email',
            status: 'skipped',
            message,
            error: 'Sin correo en la cuenta',
          });
          skipped += 1;
        } else if (!process.env.RESEND_API_KEY) {
          await logDelivery(admin, {
            condominiumId: input.condominiumId,
            unitId: input.unitId,
            userId,
            chargeId: input.chargeId,
            channel: 'email',
            status: 'skipped',
            message,
            error: 'RESEND_API_KEY no configurada',
          });
          skipped += 1;
        } else {
          const ok = await sendReminderEmail(
            email,
            title,
            `<p>Hola,</p><p>${message}</p><p>— Administración Veka</p>`,
          );
          if (ok) emailSent += 1;
          else failures += 1;
          await logDelivery(admin, {
            condominiumId: input.condominiumId,
            unitId: input.unitId,
            userId,
            chargeId: input.chargeId,
            channel: 'email',
            status: ok ? 'sent' : 'failed',
            message,
            error: ok ? undefined : 'Error al enviar correo',
          });
        }
      }
    }
  }

  return { pushSent, emailSent, skipped, failures };
}

export type ReservationNotificationKind = 'approved' | 'cancelled' | 'rejected';

export interface ReservationNotificationInput {
  condominiumId: string;
  unitId: string;
  userId: string;
  reservationId: string;
  amenityName: string;
  startsAt: string;
  kind: ReservationNotificationKind;
  notifyPush?: boolean;
  notifyEmail?: boolean;
}

export async function deliverReservationUpdate(
  input: ReservationNotificationInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const notifyPush = input.notifyPush ?? true;
  const notifyEmail = input.notifyEmail ?? true;

  const when = new Date(input.startsAt).toLocaleString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const title =
    input.kind === 'approved'
      ? 'Reserva confirmada — Veka'
      : input.kind === 'rejected'
        ? 'Solicitud rechazada — Veka'
        : 'Reserva cancelada — Veka';
  const message =
    input.kind === 'approved'
      ? `Tu reserva de ${input.amenityName} (${when}) fue aprobada.`
      : input.kind === 'rejected'
        ? `Tu solicitud de ${input.amenityName} (${when}) fue rechazada por administración.`
        : `Tu reserva de ${input.amenityName} (${when}) fue cancelada por administración.`;

  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  if (notifyPush) {
    const tokens = await getUserPushTokens(admin, input.userId);
    if (tokens.length === 0) {
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId: input.userId,
        chargeId: null,
        channel: 'push',
        status: 'skipped',
        message,
        error: 'Sin token push registrado',
      });
      skipped += 1;
    } else {
      const result = await sendExpoPush(tokens, title, message, {
        reservationId: input.reservationId,
        screen: 'spaces',
      });
      pushSent += result.sent;
      failures += result.failed;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId: input.userId,
        chargeId: null,
        channel: 'push',
        status: result.sent > 0 ? 'sent' : 'failed',
        message,
        error: result.sent > 0 ? undefined : 'No se pudo entregar push',
      });
    }
  }

  if (notifyEmail) {
    const email = await getUserEmail(admin, input.userId);
    if (!email) {
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId: input.userId,
        chargeId: null,
        channel: 'email',
        status: 'skipped',
        message,
        error: 'Sin correo en la cuenta',
      });
      skipped += 1;
    } else if (!process.env.RESEND_API_KEY) {
      skipped += 1;
    } else {
      const ok = await sendReminderEmail(
        email,
        title,
        `<p>Hola,</p><p>${message}</p><p>— Administración Veka</p>`,
      );
      if (ok) emailSent += 1;
      else failures += 1;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId: input.userId,
        chargeId: null,
        channel: 'email',
        status: ok ? 'sent' : 'failed',
        message,
        error: ok ? undefined : 'Error al enviar correo',
      });
    }
  }

  return { pushSent, emailSent, skipped, failures };
}

async function getCondoStaffUserIds(admin: SupabaseClient, condominiumId: string): Promise<string[]> {
  const { data } = await admin
    .from('memberships')
    .select('user_id')
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .in('role', ['super_admin', 'admin', 'board_member', 'staff']);

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

async function getCondoMemberUserIds(admin: SupabaseClient, condominiumId: string): Promise<string[]> {
  const { data } = await admin
    .from('memberships')
    .select('user_id')
    .eq('condominium_id', condominiumId)
    .eq('status', 'active');

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

export interface CommunityPostNotificationInput {
  condominiumId: string;
  postId: string;
  title: string;
  body?: string | null;
  postType: 'announcement' | 'poll' | 'photo';
  isPinned: boolean;
  excludeUserId?: string | null;
  clusterIds?: string[] | null;
}

function communityPushCopy(input: CommunityPostNotificationInput): { title: string; message: string } {
  const preview = input.body?.trim() || input.title;
  const clipped = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;

  if (input.postType === 'poll') {
    return {
      title: 'Nueva encuesta — Veka',
      message: input.isPinned ? `Encuesta fijada: ${input.title}` : `Nueva encuesta: ${input.title}`,
    };
  }

  if (input.postType === 'photo') {
    return {
      title: 'Nueva publicación — Veka',
      message: input.isPinned ? `Foto fijada: ${input.title}` : `Nueva foto: ${input.title}`,
    };
  }

  return {
    title: input.isPinned ? 'Aviso importante — Veka' : 'Nuevo aviso — Veka',
    message: input.isPinned ? `Aviso fijado: ${clipped}` : `Nuevo aviso: ${clipped}`,
  };
}

export async function deliverCommunityPost(
  input: CommunityPostNotificationInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const { title, message } = communityPushCopy(input);

  const memberIds = await getMemberUserIdsForScope(admin, input.condominiumId, input.clusterIds);
  const targets = input.excludeUserId
    ? memberIds.filter((userId) => userId !== input.excludeUserId)
    : memberIds;

  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const userId of targets) {
    const tokens = await getUserPushTokens(admin, userId);
    if (tokens.length === 0) {
      skipped += 1;
    } else {
      const result = await sendExpoPush(tokens, title, message, {
        screen: 'community',
        postId: input.postId,
      });
      pushSent += result.sent;
      failures += result.failed;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: null,
        userId,
        chargeId: null,
        channel: 'push',
        status: result.sent > 0 ? 'sent' : 'failed',
        message,
        error: result.sent > 0 ? undefined : 'No se pudo entregar push',
      });
    }
  }

  return { pushSent, emailSent, skipped, failures };
}

export interface CommunityPollClosedNotificationInput {
  condominiumId: string;
  postId: string;
  title: string;
  clusterIds?: string[] | null;
}

export async function deliverCommunityPollClosed(
  input: CommunityPollClosedNotificationInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const title = 'Encuesta cerrada — Veka';
  const message = `Resultados disponibles: ${input.title}`;
  const memberIds = await getMemberUserIdsForScope(admin, input.condominiumId, input.clusterIds);

  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const userId of memberIds) {
    const tokens = await getUserPushTokens(admin, userId);
    if (tokens.length === 0) {
      skipped += 1;
    } else {
      const result = await sendExpoPush(tokens, title, message, {
        screen: 'community',
        postId: input.postId,
      });
      pushSent += result.sent;
      failures += result.failed;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: null,
        userId,
        chargeId: null,
        channel: 'push',
        status: result.sent > 0 ? 'sent' : 'failed',
        message,
        error: result.sent > 0 ? undefined : 'No se pudo entregar push',
      });
    }
  }

  return { pushSent, emailSent, skipped, failures };
}

export interface AdminPendingReservationInput {
  condominiumId: string;
  unitId: string;
  reservationId: string;
  amenityName: string;
  unitIdentifier: string;
  startsAt: string;
}

export async function deliverAdminPendingReservation(
  input: AdminPendingReservationInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const when = new Date(input.startsAt).toLocaleString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const title = 'Nueva solicitud de reserva — Veka';
  const message = `Unidad ${input.unitIdentifier} solicitó ${input.amenityName} (${when}). Requiere aprobación en el panel.`;

  const staffIds = await getCondoStaffUserIds(admin, input.condominiumId);
  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const userId of staffIds) {
    const tokens = await getUserPushTokens(admin, userId);
    if (tokens.length === 0) {
      skipped += 1;
    } else {
      const result = await sendExpoPush(tokens, title, message, {
        kind: 'admin_pending_reservation',
      });
      pushSent += result.sent;
      failures += result.failed;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId,
        chargeId: null,
        channel: 'push',
        status: result.sent > 0 ? 'sent' : 'failed',
        message,
      });
    }

    const email = await getUserEmail(admin, userId);
    if (!email || !process.env.RESEND_API_KEY) {
      skipped += 1;
      continue;
    }

    const ok = await sendReminderEmail(
      email,
      title,
      `<p>Hola,</p><p>${message}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://veka-admin.vercel.app'}/espacios">Abrir panel de espacios</a></p><p>— Veka</p>`,
    );
    if (ok) emailSent += 1;
    else failures += 1;
    await logDelivery(admin, {
      condominiumId: input.condominiumId,
      unitId: input.unitId,
      userId,
      chargeId: null,
      channel: 'email',
      status: ok ? 'sent' : 'failed',
      message,
    });
  }

  return { pushSent, emailSent, skipped, failures };
}

export interface AdminNewMaintenanceTicketInput {
  condominiumId: string;
  unitId: string;
  ticketId: string;
  ticketTitle: string;
  unitIdentifier: string;
  categoryLabel: string;
}

export async function deliverAdminNewMaintenanceTicket(
  input: AdminNewMaintenanceTicketInput,
): Promise<ReminderDeliveryResult> {
  const admin = createAdminClient();
  const title = 'Nuevo reporte de mantenimiento — Veka';
  const message = `Unidad ${input.unitIdentifier} reportó «${input.ticketTitle}» (${input.categoryLabel}). Revisa el ticket en el panel.`;
  const panelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://veka-admin.vercel.app'}/mantenimiento`;

  const staffIds = await getCondoStaffUserIds(admin, input.condominiumId);
  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let failures = 0;

  for (const userId of staffIds) {
    const tokens = await getUserPushTokens(admin, userId);
    if (tokens.length === 0) {
      skipped += 1;
    } else {
      const result = await sendExpoPush(tokens, title, message, {
        screen: 'maintenance',
        ticketId: input.ticketId,
      });
      pushSent += result.sent;
      failures += result.failed;
      await logDelivery(admin, {
        condominiumId: input.condominiumId,
        unitId: input.unitId,
        userId,
        chargeId: null,
        channel: 'push',
        status: result.sent > 0 ? 'sent' : 'failed',
        message,
      });
    }

    const email = await getUserEmail(admin, userId);
    if (!email || !process.env.RESEND_API_KEY) {
      skipped += 1;
      continue;
    }

    const ok = await sendReminderEmail(
      email,
      title,
      `<p>Hola,</p><p>${message}</p><p><a href="${panelUrl}">Abrir panel de mantenimiento</a></p><p>— Veka</p>`,
    );
    if (ok) emailSent += 1;
    else failures += 1;
    await logDelivery(admin, {
      condominiumId: input.condominiumId,
      unitId: input.unitId,
      userId,
      chargeId: null,
      channel: 'email',
      status: ok ? 'sent' : 'failed',
      message,
    });
  }

  return { pushSent, emailSent, skipped, failures };
}
