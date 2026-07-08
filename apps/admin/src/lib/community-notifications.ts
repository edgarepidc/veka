import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

export type CommunityNotificationType =
  | 'community_poll'
  | 'community_poll_closed'
  | 'community_comment'
  | 'community_announcement';

export interface CreateUserNotificationInput {
  condominiumId: string;
  userId: string;
  notificationType: CommunityNotificationType;
  title: string;
  body?: string | null;
  entityId?: string | null;
}

async function getCondoMemberUserIds(admin: SupabaseClient, condominiumId: string): Promise<string[]> {
  const { data } = await admin
    .from('memberships')
    .select('user_id')
    .eq('condominium_id', condominiumId)
    .eq('status', 'active');

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

export async function createUserNotifications(
  inputs: CreateUserNotificationInput[],
): Promise<{ inserted: number }> {
  if (inputs.length === 0) return { inserted: 0 };

  const admin = createAdminClient();
  const rows = inputs.map((input) => ({
    condominium_id: input.condominiumId,
    user_id: input.userId,
    notification_type: input.notificationType,
    title: input.title,
    body: input.body ?? null,
    entity_type: 'post',
    entity_id: input.entityId ?? null,
  }));

  const { error } = await admin.from('user_notifications').insert(rows);
  if (error) throw new Error(error.message);

  return { inserted: rows.length };
}

export async function notifyCondoMembersInApp(input: {
  condominiumId: string;
  notificationType: CommunityNotificationType;
  title: string;
  body?: string | null;
  entityId?: string | null;
  excludeUserId?: string | null;
}): Promise<{ inserted: number }> {
  const admin = createAdminClient();
  const memberIds = await getCondoMemberUserIds(admin, input.condominiumId);
  const targets = input.excludeUserId
    ? memberIds.filter((id) => id !== input.excludeUserId)
    : memberIds;

  return createUserNotifications(
    targets.map((userId) => ({
      condominiumId: input.condominiumId,
      userId,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      entityId: input.entityId,
    })),
  );
}
