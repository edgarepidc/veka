import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

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
    .select('id, charge_id, condominium_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !payment) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  }

  if (action === 'approve') {
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await supabase
      .from('charges')
      .update({ status: 'paid' })
      .eq('id', payment.charge_id);

    return NextResponse.json({ ok: true });
  }

  const { error: rejectError } = await supabase
    .from('payments')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? 'Comprobante no válido',
    })
    .eq('id', id);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
