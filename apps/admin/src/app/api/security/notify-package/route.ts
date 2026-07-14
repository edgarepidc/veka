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

  const body = (await request.json()) as { packageId?: string };
  const packageId = body.packageId?.trim();
  if (!packageId) {
    return NextResponse.json({ error: 'Paquete inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from('packages')
    .select('id, unit_id, carrier, tracking_number, condominium_id, received_by')
    .eq('id', packageId)
    .maybeSingle();

  if (!pkg) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

  if (pkg.received_by !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const label = pkg.carrier || 'Paquete';
  const tracking = pkg.tracking_number ? ` · Guía ${pkg.tracking_number}` : '';

  await deliverUnitPushNotification({
    unitId: pkg.unit_id,
    title: 'Paquete en caseta — Veka',
    body: `${label}${tracking}. Pasa por recepción cuando puedas.`,
    data: { screen: 'security', tab: 'paquetes', packageId: pkg.id },
  });

  return NextResponse.json({ ok: true });
}
