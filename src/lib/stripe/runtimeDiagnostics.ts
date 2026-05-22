import { readServerEnv } from '@/lib/envServer'

/** TEMP: safe runtime snapshot for Stripe checkout host/env debugging (no secrets). */
export function logStripeRuntimeDiagnostics(request: Request) {
  const host = request.headers.get('host')
  const readKey = readServerEnv('STRIPE_SECRET_KEY')
  const directKey = process.env.STRIPE_SECRET_KEY

  console.log('[stripe/runtime]', {
    host,
    xForwardedHost: request.headers.get('x-forwarded-host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    hasStripeSecret: Boolean(directKey),
    stripeSecretLength: directKey?.length ?? 0,
    hasStripeSecretRead: Boolean(readKey),
    stripeSecretReadLength: readKey?.length ?? 0,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    nextPublicSiteUrl: readServerEnv('NEXT_PUBLIC_SITE_URL'),
  })
}

export function stripeNotConfiguredPayload(request: Request) {
  const host = request.headers.get('host')
  const hasStripeSecret = Boolean(readServerEnv('STRIPE_SECRET_KEY'))

  return {
    error: 'stripe_not_configured' as const,
    message: 'El pago no está configurado todavía. Inténtalo más tarde.',
    host,
    vercelEnv: readServerEnv('VERCEL_ENV') ?? null,
    hasStripeSecret,
  }
}
