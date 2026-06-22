import type Stripe from 'stripe';

import { getStripe } from '@/lib/stripe';

export type GatewayCheckoutMethod = 'card' | 'oxxo' | 'spei' | 'all';

export interface CheckoutSessionInput {
  amount: number;
  currency?: string;
  productName: string;
  productDescription: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  method?: GatewayCheckoutMethod;
  customerEmail?: string | null;
}

export interface CheckoutSessionResult {
  session: Stripe.Checkout.Session;
  gatewayMethod: string;
  requiresAsyncPayment: boolean;
}

function resolvePaymentMethodTypes(
  method: GatewayCheckoutMethod,
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  if (method === 'card') return ['card'];
  if (method === 'oxxo') return ['oxxo'];
  if (method === 'spei') return ['customer_balance'];
  return ['card', 'oxxo'];
}

export async function createGatewayCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const stripe = getStripe();
  const method = input.method ?? 'all';
  const paymentMethodTypes = resolvePaymentMethodTypes(method);
  const requiresAsyncPayment = method === 'oxxo' || method === 'spei' || method === 'all';

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: paymentMethodTypes,
    line_items: [
      {
        price_data: {
          currency: input.currency ?? 'mxn',
          product_data: {
            name: input.productName,
            description: input.productDescription,
          },
          unit_amount: Math.round(input.amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: input.metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };

  if (method === 'spei') {
    const customer = await stripe.customers.create({
      email: input.customerEmail ?? undefined,
      metadata: input.metadata,
    });
    params.customer = customer.id;
    params.payment_method_options = {
      customer_balance: {
        funding_type: 'bank_transfer',
        bank_transfer: {
          type: 'mx_bank_transfer',
        },
      },
    };
  }

  const session = await stripe.checkout.sessions.create(params);

  return {
    session,
    gatewayMethod: method === 'all' ? 'card' : method,
    requiresAsyncPayment,
  };
}

export function gatewayMethodFromSession(session: Stripe.Checkout.Session): string {
  const types = session.payment_method_types ?? [];
  if (types.includes('oxxo')) return 'oxxo';
  if (types.includes('customer_balance')) return 'spei';
  return 'card';
}

export async function syncGatewayPaymentFromSession(
  session: Stripe.Checkout.Session,
): Promise<{
  shouldApprove: boolean;
  awaitingPayment: boolean;
  gatewayMethod: string;
  gatewayReference: string | null;
  gatewayExpiresAt: string | null;
  gatewayStatus: string;
}> {
  const gatewayMethod = gatewayMethodFromSession(session);
  const paid = session.payment_status === 'paid';
  const unpaidAsync = session.payment_status === 'unpaid' && (gatewayMethod === 'oxxo' || gatewayMethod === 'spei');

  let gatewayReference: string | null = null;
  let gatewayExpiresAt: string | null = null;

  if (session.id && unpaidAsync) {
    const stripe = getStripe();
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['payment_intent', 'payment_intent.next_action'],
    });
    const paymentIntent =
      typeof fullSession.payment_intent === 'string'
        ? null
        : fullSession.payment_intent;

    if (gatewayMethod === 'oxxo' && paymentIntent?.next_action?.oxxo_display_details) {
      gatewayReference = paymentIntent.next_action.oxxo_display_details.number ?? null;
      gatewayExpiresAt = paymentIntent.next_action.oxxo_display_details.expires_after
        ? new Date(paymentIntent.next_action.oxxo_display_details.expires_after * 1000).toISOString()
        : null;
    }

    if (gatewayMethod === 'spei' && paymentIntent?.next_action?.display_bank_transfer_instructions) {
      const instructions = paymentIntent.next_action.display_bank_transfer_instructions as {
        reference?: string | null;
        account_number?: string | null;
        expires_at?: number | null;
      };
      gatewayReference = instructions.reference ?? instructions.account_number ?? null;
      gatewayExpiresAt = instructions.expires_at
        ? new Date(instructions.expires_at * 1000).toISOString()
        : null;
    }
  }

  return {
    shouldApprove: paid,
    awaitingPayment: unpaidAsync,
    gatewayMethod,
    gatewayReference,
    gatewayExpiresAt,
    gatewayStatus: paid ? 'paid' : unpaidAsync ? 'awaiting_payment' : session.status ?? 'open',
  };
}
