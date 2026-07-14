import { NextResponse } from 'next/server';

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
    visitId?: string;
    event?: 'check_in' | 'check_out';
  };
  const visitId = body.visitId?.trim();
  const event = body.event === 'check_out' ? 'check_out' : 'check_in';

  if (!visitId) {
    return NextResponse.json({ error: 'Visita inválida' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: visit } = await admin
    .from('visits')
    .select('id, unit_id, visitor_name, visit_type, checked_in_by, created_by')
    .eq('id', visitId)
    .maybeSingle();

  if (!visit) {
    return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 });
  }

  if (!visit.unit_id) {
    return NextResponse.json({ error: 'Visita sin unidad' }, { status: 400 });
  }

  const { data: membership } = await admin
    .from('memberships')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['super_admin', 'admin', 'guard', 'staff'])
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const name = visit.visitor_name || 'Tu visita';

  if (event === 'check_out') {
    await deliverUnitPushNotification({
      unitId: visit.unit_id,
      title: 'Visita salió de caseta — Veka',
      body: `${name} registró salida en recepción.`,
      data: { screen: 'security', tab: 'visitas', visitId: visit.id },
    });
  } else {
    await deliverUnitPushNotification({
      unitId: visit.unit_id,
      title: 'Visita en caseta — Veka',
      body: `${name} acaba de ingresar.`,
      data: { screen: 'security', tab: 'visitas', visitId: visit.id },
    });
  }

  return NextResponse.json({ ok: true });
}
