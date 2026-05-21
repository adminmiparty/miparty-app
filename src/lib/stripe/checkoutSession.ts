import type Stripe from 'stripe'

export function isStripeCheckoutPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === 'paid' || session.status === 'complete'
}
