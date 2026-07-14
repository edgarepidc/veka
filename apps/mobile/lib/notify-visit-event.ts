import { supabase } from '@/lib/supabase';

export async function notifyVisitEvent(
  visitId: string,
  event: 'check_in' | 'check_out',
): Promise<{ ok: boolean }> {
  const adminUrl = process.env.EXPO_PUBLIC_ADMIN_URL?.replace(/\/$/, '');
  if (!adminUrl) return { ok: false };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false };

  try {
    const response = await fetch(`${adminUrl}/api/security/notify-visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ visitId, event }),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
