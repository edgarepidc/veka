import { NextResponse } from 'next/server';

import {
  MAINTENANCE_TICKET_BOARD_STATUSES,
  maintenanceTicketPushCopy,
  ticketBoardStatus,
  type MaintenanceTicketStatus,
} from '@veka/shared';

import { deliverUnitPushNotification } from '@/lib/unit-push';
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

  const body = (await request.json()) as {
    ticketId?: string;
    status?: string;
    adminNotes?: string;
  };
  const ticketId = body.ticketId?.trim();
  const rawStatus = String(body.status ?? '') as MaintenanceTicketStatus;
  const adminNotes = body.adminNotes?.trim() ?? '';

  if (!ticketId) {
    return NextResponse.json({ error: 'Ticket inválido' }, { status: 400 });
  }
  if (!(MAINTENANCE_TICKET_BOARD_STATUSES as readonly string[]).includes(rawStatus) && rawStatus !== 'closed') {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const status = ticketBoardStatus(rawStatus);
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from('memberships')
    .select('id, role, condominium_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['super_admin', 'admin', 'staff'])
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data: ticket } = await admin
    .from('maintenance_tickets')
    .select('id, status, title, unit_id, condominium_id')
    .eq('id', ticketId)
    .eq('condominium_id', membership.condominium_id)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
  }

  const { error } = await admin
    .from('maintenance_tickets')
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    })
    .eq('id', ticketId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (ticket.status !== status && ticket.unit_id) {
    const copy = maintenanceTicketPushCopy(status, ticket.title);
    await deliverUnitPushNotification({
      unitId: ticket.unit_id,
      title: copy.title,
      body: copy.body,
      data: { screen: 'maintenance', ticketId, ticket_id: ticketId },
    });
  }

  return NextResponse.json({ ok: true, status });
}
