/**
 * Read server env at request/runtime (dynamic key — avoids Next.js build-time inlining
 * when secrets are only injected on Vercel at runtime).
 */
export function readServerEnv(name: string): string | undefined {
  const value = process.env[name]
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export type PaymentConfigFlags = {
  stripeSecretKey: boolean
  stripeSecretKeyLength: number
  stripeWebhookSecret: boolean
  supabaseServiceRoleKey: boolean
  supabaseUrl: boolean
  siteUrl: boolean
  eventPriceEur: boolean
  nextPublicEventPriceEur: boolean
  freeOrganizedEventsEnabled: boolean
  freeOrganizedEventsLimit: boolean
}

/** Safe presence check for payment-related env (never logs secret values). */
export function getPaymentConfigFlags(): PaymentConfigFlags {
  const stripeSecretKey = readServerEnv('STRIPE_SECRET_KEY')

  return {
    stripeSecretKey: Boolean(stripeSecretKey),
    stripeSecretKeyLength: stripeSecretKey?.length ?? 0,
    stripeWebhookSecret: Boolean(readServerEnv('STRIPE_WEBHOOK_SECRET')),
    supabaseServiceRoleKey: Boolean(readServerEnv('SUPABASE_SERVICE_ROLE_KEY')),
    supabaseUrl: Boolean(readServerEnv('NEXT_PUBLIC_SUPABASE_URL')),
    siteUrl: Boolean(
      readServerEnv('NEXT_PUBLIC_SITE_URL') ?? readServerEnv('VERCEL_URL')
    ),
    eventPriceEur: Boolean(readServerEnv('EVENT_PRICE_EUR')),
    nextPublicEventPriceEur: Boolean(readServerEnv('NEXT_PUBLIC_EVENT_PRICE_EUR')),
    freeOrganizedEventsEnabled:
      readServerEnv('NEXT_PUBLIC_FREE_ORGANIZED_EVENTS_ENABLED') === 'true',
    freeOrganizedEventsLimit: Boolean(
      readServerEnv('FREE_ORGANIZED_EVENTS_LIMIT') ??
        readServerEnv('NEXT_PUBLIC_FREE_ORGANIZED_EVENTS_LIMIT')
    ),
  }
}

export function logPaymentConfigFlags(context: string): PaymentConfigFlags {
  const flags = getPaymentConfigFlags()
  console.info(`[payment-config] ${context}`, flags)
  return flags
}
