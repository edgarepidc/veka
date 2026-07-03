import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

export async function getUnitResidentUserIds(supabase: SupabaseClient, unitId: string): Promise<string[]> {
  const { data } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('unit_id', unitId)
    .eq('status', 'active');

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

export async function getUserPushTokens(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  return (data ?? []).map((row) => row.token as string);
}

export async function sendExpoPushNotifications(
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

export async function deliverUnitPushNotification(input: {
  unitId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ pushSent: number; failures: number }> {
  const admin = createAdminClient();
  const userIds = await getUnitResidentUserIds(admin, input.unitId);

  let pushSent = 0;
  let failures = 0;

  for (const userId of userIds) {
    const tokens = await getUserPushTokens(admin, userId);
    const result = await sendExpoPushNotifications(tokens, input.title, input.body, input.data);
    pushSent += result.sent;
    failures += result.failed;
  }

  return { pushSent, failures };
}
