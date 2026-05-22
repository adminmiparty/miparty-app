export type VerifyCheckoutResult = {
  ok: boolean
  status: number
  paid?: boolean
  published?: boolean
  slug?: string | null
  error?: string
}

export async function verifyCheckoutReturn(sessionId: string): Promise<VerifyCheckoutResult> {
  const res = await fetch(
    `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`,
    { credentials: 'include' }
  )

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return { ok: false, status: res.status, error: 'Respuesta inesperada al confirmar el pago' }
  }

  const data = (await res.json()) as VerifyCheckoutResult
  return { ...data, ok: res.ok, status: res.status }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Stripe redirect can arrive before status is active — retry briefly. */
export async function verifyCheckoutReturnWithRetry(
  sessionId: string,
  maxAttempts = 8
): Promise<VerifyCheckoutResult> {
  let last: VerifyCheckoutResult = { ok: false, status: 0, error: 'No se pudo confirmar el pago' }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await verifyCheckoutReturn(sessionId)
    if (last.ok && last.published && last.slug) {
      return last
    }
    if (!last.ok && last.status === 401) {
      return last
    }
    if (attempt < maxAttempts - 1) {
      await sleep(attempt < 2 ? 500 : 1000)
    }
  }

  return last
}
