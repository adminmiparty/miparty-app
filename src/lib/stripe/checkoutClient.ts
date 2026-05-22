import {
  getCheckoutClientDiagnostics,
  logCheckoutClientDiagnostics,
} from '@/lib/stripe/checkoutDiagnostics'

/** Safe client-side helper for starting Stripe Checkout (no secrets). */

export type StripeCheckoutApiResponse = {
  url?: string
  error?: string
  message?: string
  host?: string | null
  vercelEnv?: string | null
  hasStripeSecret?: boolean
}

const CHECKOUT_API_PATH = '/api/stripe/checkout'

export async function postStripeCheckout(eventId: string): Promise<{
  ok: boolean
  status: number
  data: StripeCheckoutApiResponse
  parseError?: string
  fetchUrl: string
}> {
  const fetchUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${CHECKOUT_API_PATH}`
      : CHECKOUT_API_PATH

  logCheckoutClientDiagnostics('fetch', { fetchUrl, eventId })

  const res = await fetch(CHECKOUT_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ eventId }),
  })

  const diag = getCheckoutClientDiagnostics()
  console.log('[publish/checkout] fetch response', {
    ...diag,
    fetchUrl,
    status: res.status,
    ok: res.ok,
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const snippet = (await res.text()).slice(0, 120)
    const result = {
      ok: false,
      status: res.status,
      data: { error: 'Respuesta inesperada del servidor' },
      parseError: `non-json:${res.status}:${snippet}`,
      fetchUrl,
    }
    console.log('[publish/checkout] fetch response body', {
      ...diag,
      status: res.status,
      error: result.data.error,
      parseError: result.parseError,
    })
    return result
  }

  try {
    const data = (await res.json()) as StripeCheckoutApiResponse
    console.log('[publish/checkout] fetch response body', {
      ...diag,
      status: res.status,
      error: data.error ?? null,
      hasCheckoutUrl: Boolean(data.url),
    })
    return { ok: res.ok, status: res.status, data, fetchUrl }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'json-parse-failed'
    return {
      ok: false,
      status: res.status,
      data: { error: 'No se pudo leer la respuesta del servidor' },
      parseError: message,
      fetchUrl,
    }
  }
}
