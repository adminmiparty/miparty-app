/** Safe client-side helper for starting Stripe Checkout (no secrets). */

export type StripeCheckoutApiResponse = {
  url?: string
  error?: string
}

export async function postStripeCheckout(eventId: string): Promise<{
  ok: boolean
  status: number
  data: StripeCheckoutApiResponse
  parseError?: string
}> {
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/stripe/checkout`
      : '/api/stripe/checkout'

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ eventId }),
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const snippet = (await res.text()).slice(0, 120)
    return {
      ok: false,
      status: res.status,
      data: { error: 'Respuesta inesperada del servidor' },
      parseError: `non-json:${res.status}:${snippet}`,
    }
  }

  try {
    const data = (await res.json()) as StripeCheckoutApiResponse
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'json-parse-failed'
    return {
      ok: false,
      status: res.status,
      data: { error: 'No se pudo leer la respuesta del servidor' },
      parseError: message,
    }
  }
}
