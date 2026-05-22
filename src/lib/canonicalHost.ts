import type { NextRequest } from 'next/server'

/**
 * Redirect www ↔ apex mismatches to NEXT_PUBLIC_SITE_URL host so auth cookies
 * and API fetch share one origin (common mobile vs desktop difference).
 */
export function getCanonicalHostRedirect(request: NextRequest): URL | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return null

  let canonical: URL
  try {
    canonical = new URL(site)
  } catch {
    return null
  }

  const current = request.nextUrl

  if (
    current.hostname === 'localhost' ||
    current.hostname === '127.0.0.1' ||
    current.hostname.endsWith('.vercel.app')
  ) {
    return null
  }

  if (current.host === canonical.host) return null

  const apex = canonical.host.replace(/^www\./, '')
  const currentApex = current.host.replace(/^www\./, '')
  if (apex !== currentApex) return null

  const url = current.clone()
  url.host = canonical.host
  url.protocol = canonical.protocol
  return url
}
