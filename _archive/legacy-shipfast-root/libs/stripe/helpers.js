/**
 * Stripe helpers: defensive parsing and shared utilities.
 * Single source for invoice line parsing to avoid drift.
 */

/**
 * Defensively find subscription price ID from invoice lines.
 * Invoices can contain multiple lines (proration, discounts, etc).
 * @param {Object} invoice - Stripe invoice object
 * @returns {string | null} - Price ID or null
 */
export function findSubscriptionPriceId(invoice) {
  if (!invoice?.lines?.data) return null;
  const line = invoice.lines.data.find(
    (ln) => ln.type === "subscription" && ln.price?.id
  );
  return line?.price?.id || null;
}
