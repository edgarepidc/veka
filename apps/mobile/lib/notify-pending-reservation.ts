import { supabase } from '@/lib/supabase';

export async function notifyPendingReservation(reservationId: string): Promise<void> {
  const adminUrl = process.env.EXPO_PUBLIC_ADMIN_URL?.replace(/\/$/, '');
  if (!adminUrl) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return;

  try {
    await fetch(`${adminUrl}/api/reservations/notify-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reservationId }),
    });
  } catch {
    // Best-effort — reservation already created
  }
}
