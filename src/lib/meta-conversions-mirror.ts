import type { MetaPixelEventName } from '@/lib/meta-conversions-api'

export type MirrorMetaConversionPayload = {
  eventName: MetaPixelEventName
  eventSourceUrl: string
  eventId?: string
  contentName?: string
  value?: number
  currency?: string
  userPhone?: string
}

/** Fire-and-forget Conversions API gateway (POST /api/meta/event). */
export function mirrorMetaConversionToServer(payload: MirrorMetaConversionPayload): void {
  if (typeof window === 'undefined') return

  void fetch('/api/meta/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

