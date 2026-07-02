import { createClient } from '@/lib/supabase/server';

/** Accepts pending invitations matching the logged-in user's email (same as mobile app). */
export async function acceptPendingInvitations(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.rpc('accept_pending_invitations');
}
