import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface PlatformSession {
  userId: string;
  email: string;
}

function parseAllowlist(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdminUser(userId: string, email?: string | null): Promise<boolean> {
  const normalizedEmail = email?.trim().toLowerCase();
  const allowlist = parseAllowlist();
  if (normalizedEmail && allowlist.includes(normalizedEmail)) return true;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch {
    return normalizedEmail ? allowlist.includes(normalizedEmail) : false;
  }
}

export async function loadPlatformSession(): Promise<PlatformSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const email = user.email ?? '';
  const allowed = await isPlatformAdminUser(user.id, email);
  if (!allowed) return null;

  return { userId: user.id, email };
}
