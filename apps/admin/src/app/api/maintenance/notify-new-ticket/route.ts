import { NextResponse } from 'next/server';

import { ticketCategoryLabel } from '@veka/shared';
import type { MaintenanceTicketCategory } from '@veka/shared';

import { deliverAdminNewMaintenanceTicket } from '@/lib/notifications';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await request.json()) as { ticketId?: string };
  const ticketId = body.ticketId?.trim();
  if (!ticketId) {
    return NextResponse.json({ error: 'Ticket inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from('maintenance_tickets')
    .select('id, title, category, status, unit_id, condominium_id, created_by, unit:units(identifier)')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
  }

  if (ticket.created_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (ticket.status !== 'open') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const unit = Array.isArray(ticket.unit) ? ticket.unit[0] : ticket.unit;

  await deliverAdminNewMaintenanceTicket({
    condominiumId: ticket.condominium_id,
    unitId: ticket.unit_id,
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    unitIdentifier: unit?.identifier ?? '—',
    categoryLabel: ticketCategoryLabel(ticket.category as MaintenanceTicketCategory),
  });

  return NextResponse.json({ ok: true });
}
