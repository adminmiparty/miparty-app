import Stripe from 'stripe'
import { readServerEnv } from '@/lib/envServer'

let stripeClient: Stripe | null = null
let stripeClientKeyFingerprint: string | null = null

export function readStripeSecretKey(): string | undefined {
  return readServerEnv('STRIPE_SECRET_KEY')
}

export type StripeInitResult =
  | { ok: true; stripe: Stripe }
  | { ok: false; reason: 'missing_secret_key' | 'invalid_secret_key' | 'stripe_init_failed' }

/** Initialize Stripe with runtime env (safe for Vercel serverless). */
export function initStripe(): StripeInitResult {
  const key = readStripeSecretKey()
  if (!key) {
    return { ok: false, reason: 'missing_secret_key' }
  }

  if (!key.startsWith('sk_')) {
    return { ok: false, reason: 'invalid_secret_key' }
  }

  const fingerprint = `${key.length}:${key.slice(0, 7)}`
  if (stripeClient && stripeClientKeyFingerprint === fingerprint) {
    return { ok: true, stripe: stripeClient }
  }

  try {
    stripeClient = new Stripe(key)
    stripeClientKeyFingerprint = fingerprint
    return { ok: true, stripe: stripeClient }
  } catch {
    stripeClient = null
    stripeClientKeyFingerprint = null
    return { ok: false, reason: 'stripe_init_failed' }
  }
}

/** @deprecated Prefer initStripe() for explicit error reasons. */
export function getStripe(): Stripe {
  const result = initStripe()
  if (!result.ok) {
    if (result.reason === 'missing_secret_key') {
      throw new Error('Missing STRIPE_SECRET_KEY')
    }
    throw new Error(`Stripe init failed: ${result.reason}`)
  }
  return result.stripe
}
