import { supabase } from '@/lib/supabase';
import type { MaintenanceTicketStatus } from '@veka/shared';

export async function updateTicketStatusRemote(input: {
  ticketId: string;
  status: MaintenanceTicketStatus;
  adminNotes?: string;
}): Promise<{ error: string | null; status?: string }> {
  const adminUrl = process.env.EXPO_PUBLIC_ADMIN_URL?.replace(/\/$/, '');
  if (!adminUrl) return { error: 'Falta EXPO_PUBLIC_ADMIN_URL.' };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'Sesión inválida.' };

  try {
    const response = await fetch(`${adminUrl}/api/maintenance/update-ticket-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ticketId: input.ticketId,
        status: input.status,
        adminNotes: input.adminNotes,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string };
    if (!response.ok) {
      return { error: payload.error ?? 'No se pudo actualizar el ticket.' };
    }
    return { error: null, status: payload.status };
  } catch {
    return { error: 'No se pudo contactar al servidor de notificaciones.' };
  }
}
