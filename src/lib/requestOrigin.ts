import { readServerEnv } from '@/lib/envServer'

/** Canonical site URL from env (fallback when request has no host). */
export function siteUrlFromEnv(): string {
  const url = readServerEnv('NEXT_PUBLIC_SITE_URL') ?? readServerEnv('VERCEL_URL')
  if (!url) return 'http://localhost:3000'
  if (url.startsWith('http')) return url.replace(/\/$/, '')
  return `https://${url}`
}

/**
 * Origin for the current request (matches the host the user is on).
 * Prefer this for Stripe return URLs so mobile/desktop hosts stay consistent.
 */
export function getRequestOrigin(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host')
  const host = (forwarded?.split(',')[0] ?? request.headers.get('host'))?.trim()
  const protoHeader = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (host) {
    const proto =
      protoHeader ||
      (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  return siteUrlFromEnv()
}

export function getRequestHostDiagnostics(request: Request) {
  return {
    origin: getRequestOrigin(request),
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    envSiteUrl: siteUrlFromEnv(),
  }
}
