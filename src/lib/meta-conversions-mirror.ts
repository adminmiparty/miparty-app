import type { MetaServerEventName } from '@/lib/meta-conversions-api'

type MirrorMetaConversionPayload = {
  eventName: MetaServerEventName
  eventSourceUrl: string
  eventId?: string
  value?: number
  currency?: string
}

/** Fire-and-forget server-side Conversions API mirror (via /api/meta/event). */
export function mirrorMetaConversionToServer(payload: MirrorMetaConversionPayload): void {
  if (typeof window === 'undefined') return

  void fetch('/api/meta/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}
