import { NextResponse } from 'next/server';

import { deliverAdminPendingReservation } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await request.json()) as { reservationId?: string };
  const reservationId = body.reservationId?.trim();
  if (!reservationId) {
    return NextResponse.json({ error: 'Reserva inválida' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reservation } = await admin
    .from('reservations')
    .select(
      'id, status, starts_at, unit_id, condominium_id, user_id, amenity:amenities(name), unit:units(identifier)',
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (reservation.user_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (reservation.status !== 'pending') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const amenity = Array.isArray(reservation.amenity) ? reservation.amenity[0] : reservation.amenity;
  const unit = Array.isArray(reservation.unit) ? reservation.unit[0] : reservation.unit;

  await deliverAdminPendingReservation({
    condominiumId: reservation.condominium_id,
    unitId: reservation.unit_id,
    reservationId: reservation.id,
    amenityName: amenity?.name ?? 'Espacio',
    unitIdentifier: unit?.identifier ?? '—',
    startsAt: reservation.starts_at,
  });

  return NextResponse.json({ ok: true });
}
