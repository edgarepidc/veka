import type { SupabaseClient } from '@supabase/supabase-js';
import { roundMoney } from '@veka/shared';

import { stampCfdiInvoice } from '@/lib/pac/facturapi';

const IVA_RATE = 0.16;

export async function maybeIssueCfdiForPayment(
  supabase: SupabaseClient,
  paymentId: string,
  createdBy: string | null,
): Promise<void> {
  const { data: payment } = await supabase
    .from('payments')
    .select('id, condominium_id, unit_id, amount, status')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment || payment.status !== 'approved' || !payment.unit_id) return;

  const { data: existing } = await supabase
    .from('cfdi_invoices')
    .select('id')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (existing) return;

  const { data: fiscalProfile } = await supabase
    .from('fiscal_profiles')
    .select('*')
    .eq('condominium_id', payment.condominium_id)
    .maybeSingle();

  if (!fiscalProfile?.auto_invoice_on_approve) return;

  const { data: unitTax } = await supabase
    .from('unit_tax_profiles')
    .select('*')
    .eq('unit_id', payment.unit_id)
    .maybeSingle();

  if (!unitTax) return;

  const total = roundMoney(Number(payment.amount));
  const subtotal = roundMoney(total / (1 + IVA_RATE));
  const iva = roundMoney(total - subtotal);

  const { data: invoice, error: insertError } = await supabase
    .from('cfdi_invoices')
    .insert({
      condominium_id: payment.condominium_id,
      payment_id: payment.id,
      unit_id: payment.unit_id,
      status: 'draft',
      subtotal,
      iva,
      total,
      series: fiscalProfile.default_series,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (insertError || !invoice) {
    console.error('[cfdi] draft insert failed:', insertError?.message);
    return;
  }

  try {
    const stamped = await stampCfdiInvoice({
      fiscalProfile,
      unitTax,
      amount: total,
      subtotal,
      iva,
      series: fiscalProfile.default_series,
      description: 'Cuota de mantenimiento',
    });

    await supabase
      .from('cfdi_invoices')
      .update({
        status: 'stamped',
        uuid_fiscal: stamped.uuid,
        folio: stamped.folio,
        series: stamped.series,
        xml_url: stamped.xmlUrl,
        pdf_url: stamped.pdfUrl,
        pac_payload: stamped.raw,
        stamped_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
  } catch (error) {
    await supabase
      .from('cfdi_invoices')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Error al timbrar CFDI',
      })
      .eq('id', invoice.id);
    console.error('[cfdi] stamp failed:', error);
  }
}

export async function issueCfdiForPaymentManual(
  supabase: SupabaseClient,
  paymentId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const { data: payment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return { error: 'Pago no encontrado.' };
  if (payment.status !== 'approved') return { error: 'Solo puedes facturar pagos aprobados.' };

  await maybeIssueCfdiForPayment(supabase, paymentId, userId);
  return { success: true };
}
