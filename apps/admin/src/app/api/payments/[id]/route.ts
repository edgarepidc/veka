import { NextResponse } from 'next/server';

import { approvePayment } from '@/lib/payment-approval';
import { deliverUnitPushNotification } from '@/lib/unit-push';
import { createClient } from '@/lib/supabase/server';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { action, rejectionReason } = body as {
    action?: 'approve' | 'reject';
    rejectionReason?: string;
  };

  if (!action) {
    return NextResponse.json({ error: 'action requerida' }, { status: 400 });
  }

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, status, first_reviewed_by, unit_id, amount, charge:charges(concept)')
    .eq('id', id)
    .single();

  if (fetchError || !payment) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  }

  if (action === 'approve') {
    const result = await approvePayment(supabase, id, user.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.pendingSecondReview && payment.unit_id) {
      const charge = Array.isArray(payment.charge) ? payment.charge[0] : payment.charge;
      const concept = (charge as { concept?: string } | null)?.concept ?? 'tu pago';
      await deliverUnitPushNotification({
        unitId: payment.unit_id,
        title: 'Comprobante aprobado — Veka',
        body: `Se aprobó ${formatCurrency(Number(payment.amount))} por ${concept}.`,
        data: { screen: 'finance' },
      });
    }

    return NextResponse.json({
      ok: true,
      settledChargeIds: result.settledChargeIds,
      pendingSecondReview: result.pendingSecondReview ?? false,
    });
  }

  if (payment.status === 'approved') {
    return NextResponse.json(
      { error: 'No se puede rechazar un pago ya aprobado. Contacta soporte si necesitas revertirlo.' },
      { status: 400 },
    );
  }

  if (payment.status === 'rejected') {
    return NextResponse.json({ error: 'Este pago ya fue rechazado.' }, { status: 400 });
  }

  const { error: rejectError } = await supabase
    .from('payments')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? 'Comprobante no válido',
      first_reviewed_by: null,
      first_reviewed_at: null,
    })
    .eq('id', id);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 400 });
  }

  if (payment.unit_id) {
    const charge = Array.isArray(payment.charge) ? payment.charge[0] : payment.charge;
    const concept = (charge as { concept?: string } | null)?.concept ?? 'tu comprobante';
    await deliverUnitPushNotification({
      unitId: payment.unit_id,
      title: 'Comprobante rechazado — Veka',
      body: `No se aprobó el pago de ${concept}. Revisa Finanzas y sube un nuevo comprobante.`,
      data: { screen: 'finance' },
    });
  }

  return NextResponse.json({ ok: true });
}
