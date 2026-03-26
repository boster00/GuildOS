/**
 * Factory functions for mock Stripe webhook event objects.
 * Used by the test-stripe webhook simulator to exercise webhook logic without real Stripe calls.
 * Structure matches what the webhook handler and findSubscriptionPriceId / computeCreditGrant expect.
 */

/**
 * Create a mock Stripe invoice object (event.data.object for invoice.paid).
 * @param {{
 *   customerId: string,
 *   subscriptionId: string,
 *   priceId: string,
 *   billingReason?: 'subscription_cycle' | 'subscription_update' | 'subscription_create',
 *   proration?: boolean
 * }} params
 * @returns {import('stripe').Stripe.Invoice}
 */
export function createMockInvoice(params) {
  const {
    customerId,
    subscriptionId,
    priceId,
    billingReason = "subscription_cycle",
    proration = false,
  } = params;

  return {
    id: `in_test_${Date.now()}`,
    object: "invoice",
    customer: customerId,
    subscription: subscriptionId,
    billing_reason: billingReason,
    lines: {
      object: "list",
      data: [
        {
          id: `il_test_${Date.now()}`,
          object: "line_item",
          type: "subscription",
          price: { id: priceId, object: "price" },
          proration: proration,
          amount: 0,
          quantity: 1,
        },
      ],
      has_more: false,
      url: "",
    },
    amount_paid: 0,
    amount_due: 0,
    paid: true,
    status: "paid",
  };
}

/**
 * Create a mock Stripe event for invoice.paid.
 * @param {{
 *   eventId?: string,
 *   customerId: string,
 *   subscriptionId: string,
 *   priceId: string,
 *   billingReason?: 'subscription_cycle' | 'subscription_update' | 'subscription_create',
 *   proration?: boolean
 * }} params
 * @returns {{ id: string, type: string, data: { object: import('stripe').Stripe.Invoice } }}
 */
export function createMockInvoicePaidEvent(params) {
  const eventId = params.eventId ?? `evt_test_invoice_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const invoice = createMockInvoice({
    customerId: params.customerId,
    subscriptionId: params.subscriptionId,
    priceId: params.priceId,
    billingReason: params.billingReason,
    proration: params.proration,
  });

  return {
    id: eventId,
    type: "invoice.paid",
    data: {
      object: invoice,
    },
  };
}

/**
 * Create a mock Stripe event for customer.subscription.deleted.
 * @param {{ eventId?: string, customerId: string }} params
 * @returns {{ id: string, type: string, data: { object: { customer: string } } }}
 */
export function createMockSubscriptionDeletedEvent(params) {
  const eventId =
    params.eventId ?? `evt_test_sub_deleted_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: eventId,
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: `sub_test_${Date.now()}`,
        object: "subscription",
        customer: params.customerId,
        status: "canceled",
      },
    },
  };
}

/**
 * Create a mock checkout.session.completed event data object.
 * Note: The real webhook calls findCheckoutSession(sessionId) which hits Stripe API.
 * This mock is for structure reference only; simulation typically uses invoice.paid + profile setup.
 * @param {{
 *   sessionId?: string,
 *   customerId: string,
 *   subscriptionId: string,
 *   priceId: string,
 *   clientReferenceId?: string
 * }} params
 * @returns {{ id: string, object: string, customer: string, subscription: string, client_reference_id?: string }}
 */
export function createMockCheckoutSession(params) {
  return {
    id: params.sessionId ?? `cs_test_${Date.now()}`,
    object: "checkout.session",
    customer: params.customerId,
    subscription: params.subscriptionId,
    client_reference_id: params.clientReferenceId ?? null,
  };
}
