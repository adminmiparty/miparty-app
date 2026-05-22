/** Safe client-side diagnostics for Stripe checkout (no secrets). */

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    userAgent
  )
}

export type CheckoutClientDiagnostics = {
  isMobile: boolean
  uaSnippet: string
  origin: string
  host: string
  pathname: string
}

export function getCheckoutClientDiagnostics(): CheckoutClientDiagnostics | null {
  if (typeof window === 'undefined') return null
  const ua = navigator.userAgent
  return {
    isMobile: isMobileUserAgent(ua),
    uaSnippet: ua.slice(0, 120),
    origin: window.location.origin,
    host: window.location.host,
    pathname: window.location.pathname,
  }
}

export function logCheckoutClientDiagnostics(
  phase: string,
  extra?: Record<string, unknown>
): CheckoutClientDiagnostics | null {
  const diag = getCheckoutClientDiagnostics()
  if (!diag) return null
  console.log(`[publish/checkout] ${phase}`, { ...diag, ...extra })
  return diag
}
