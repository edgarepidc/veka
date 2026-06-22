import type { SupabaseClient } from '@supabase/supabase-js';

import { adminBaseUrl } from '@/lib/stripe';
import {
  createGatewayCheckoutSession,
  syncGatewayPaymentFromSession,
  type GatewayCheckoutMethod,
} from '@/lib/stripe-checkout';

export interface GatewayPaymentContext {
  chargeId: string;
  condominiumId: string;
  unitId: string;
  userId: string;
  userEmail?: string | null;
  amount: number;
  productName: string;
  productDescription: string;
  metadata: Record<string, string>;
  installmentId?: string;
  method?: GatewayCheckoutMethod;
}

export async function startGatewayPayment(
  supabase: SupabaseClient,
  context: GatewayPaymentContext,
) {
  const baseUrl = adminBaseUrl();
  const { session, gatewayMethod } = await createGatewayCheckoutSession({
    amount: context.amount,
    productName: context.productName,
    productDescription: context.productDescription,
    metadata: context.metadata,
    successUrl: `${baseUrl}/api/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/api/payments/checkout/cancel`,
    method: context.method,
    customerEmail: context.userEmail,
  });

  if (!session.url) {
    throw new Error('Stripe no devolvió URL de pago.');
  }

  const sync = await syncGatewayPaymentFromSession(session);
  const initialStatus = sync.awaitingPayment ? 'awaiting_payment' : 'pending_review';

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      charge_id: context.chargeId,
      condominium_id: context.condominiumId,
      unit_id: context.unitId,
      amount: context.amount,
      status: initialStatus,
      payment_method: 'gateway',
      stripe_checkout_session_id: session.id,
      payment_plan_installment_id: context.installmentId ?? null,
      paid_at: sync.shouldApprove ? new Date().toISOString() : null,
      created_by: context.userId,
      gateway_method: sync.gatewayMethod || gatewayMethod,
      gateway_reference: sync.gatewayReference,
      gateway_expires_at: sync.gatewayExpiresAt,
      gateway_status: sync.gatewayStatus,
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    throw new Error(paymentError?.message ?? 'No se pudo registrar el pago');
  }

  return {
    url: session.url,
    paymentId: payment.id,
    amount: context.amount,
    awaitingPayment: sync.awaitingPayment,
    gatewayReference: sync.gatewayReference,
    gatewayExpiresAt: sync.gatewayExpiresAt,
  };
}
