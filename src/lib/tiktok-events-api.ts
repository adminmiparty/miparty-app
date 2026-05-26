import { createHash, randomUUID } from 'crypto'
import { readServerEnv } from '@/lib/envServer'

export const TIKTOK_SERVER_EVENT_NAMES = ['CompleteRegistration', 'Schedule', 'Purchase'] as const

export type TikTokServerEventName = (typeof TIKTOK_SERVER_EVENT_NAMES)[number]

export type SendTikTokEventParams = {
  eventName: TikTokServerEventName
  eventSourceUrl: string
  eventId?: string
  userEmail?: string
  userPhone?: string
  clientIpAddress?: string
  clientUserAgent?: string
  value?: number
  currency?: string
}

type TikTokUserContext = {
  email?: string
  phone_number?: string
}

function hashEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return undefined
  return createHash('sha256').update(normalized).digest('hex')
}

function hashPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  return createHash('sha256').update(digits).digest('hex')
}

function buildUser(params: SendTikTokEventParams): TikTokUserContext | undefined {
  const user: TikTokUserContext = {}

  if (params.userEmail) {
    const hashed = hashEmail(params.userEmail)
    if (hashed) user.email = hashed
  }

  if (params.userPhone) {
    const hashed = hashPhone(params.userPhone)
    if (hashed) user.phone_number = hashed
  }

  return Object.keys(user).length > 0 ? user : undefined
}

export function tiktokRequestContext(
  request: Request,
  pathOverride?: string
): Pick<SendTikTokEventParams, 'eventSourceUrl' | 'clientIpAddress' | 'clientUserAgent'> {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost ?? request.headers.get('host') ?? 'miparty.net'
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https'
  const pathname = pathOverride ?? url.pathname

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientIpAddress = forwardedFor ?? request.headers.get('x-real-ip') ?? undefined

  return {
    eventSourceUrl: `${proto}://${host}${pathname}`,
    clientIpAddress,
    clientUserAgent: request.headers.get('user-agent') ?? undefined,
  }
}

export async function sendTikTokEvent(params: SendTikTokEventParams): Promise<void> {
  const pixelId = readServerEnv('NEXT_PUBLIC_TIKTOK_PIXEL_ID')
  const accessToken = readServerEnv('TIKTOK_EVENTS_API_TOKEN')
  if (!pixelId || !accessToken) return

  const eventId = params.eventId?.trim() || randomUUID()

  const user = buildUser(params)

  const body: Record<string, unknown> = {
    pixel_code: pixelId,
    event: params.eventName,
    event_id: eventId,
    timestamp: new Date().toISOString(),
    context: {
      page: {
        url: params.eventSourceUrl,
      },
      ...(params.clientIpAddress?.trim() ? { ip: params.clientIpAddress.trim() } : {}),
      ...(params.clientUserAgent?.trim() ? { user_agent: params.clientUserAgent.trim() } : {}),
      ...(user ? { user } : {}),
    },
  }

  if (params.eventName === 'Purchase' && params.value != null && params.currency) {
    body.properties = { value: params.value, currency: params.currency }
  }

  const endpoint = 'https://business-api.tiktok.com/open_api/v1.3/event/track/'

  try {
    const response = await fetch(`${endpoint}?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await response.text().catch(() => undefined)
    }
  } catch {
    // Never break caller flows on TikTok API errors.
  }
}

export function sendTikTokPurchaseEvent(
  params: Omit<SendTikTokEventParams, 'eventName' | 'value' | 'currency'> & {
    stripeSessionId: string
    value?: number
    currency?: string
  }
): void {
  void sendTikTokEvent({
    eventName: 'Purchase',
    eventSourceUrl: params.eventSourceUrl,
    eventId: params.eventId ?? `purchase-${params.stripeSessionId}`,
    userEmail: params.userEmail,
    userPhone: params.userPhone,
    clientIpAddress: params.clientIpAddress,
    clientUserAgent: params.clientUserAgent,
    value: params.value ?? 1.99,
    currency: params.currency ?? 'EUR',
  })
}

