import { createHash, randomUUID } from 'crypto'
import { readServerEnv } from '@/lib/envServer'

export const META_SERVER_EVENT_NAMES = [
  'CompleteRegistration',
  'Schedule',
  'Purchase',
] as const

export type MetaServerEventName = (typeof META_SERVER_EVENT_NAMES)[number]

export type SendMetaEventParams = {
  eventName: MetaServerEventName
  eventSourceUrl: string
  eventId?: string
  userEmail?: string
  userPhone?: string
  clientIpAddress?: string
  clientUserAgent?: string
  value?: number
  currency?: string
}

type MetaUserDataPayload = {
  em?: string[]
  ph?: string[]
  client_ip_address?: string
  client_user_agent?: string
}

function hashMetaEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return undefined
  return createHash('sha256').update(normalized).digest('hex')
}

function hashMetaPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  return createHash('sha256').update(digits).digest('hex')
}

function buildUserData(params: SendMetaEventParams): MetaUserDataPayload {
  const userData: MetaUserDataPayload = {}

  if (params.userEmail) {
    const hashedEmail = hashMetaEmail(params.userEmail)
    if (hashedEmail) userData.em = [hashedEmail]
  }

  if (params.userPhone) {
    const hashedPhone = hashMetaPhone(params.userPhone)
    if (hashedPhone) userData.ph = [hashedPhone]
  }

  if (params.clientIpAddress?.trim()) {
    userData.client_ip_address = params.clientIpAddress.trim()
  }

  if (params.clientUserAgent?.trim()) {
    userData.client_user_agent = params.clientUserAgent.trim()
  }

  return userData
}

export function isMetaServerEventName(value: string): value is MetaServerEventName {
  return (META_SERVER_EVENT_NAMES as readonly string[]).includes(value)
}

export function metaRequestContext(
  request: Request,
  pathOverride?: string
): Pick<SendMetaEventParams, 'eventSourceUrl' | 'clientIpAddress' | 'clientUserAgent'> {
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

export async function sendMetaEvent(params: SendMetaEventParams): Promise<void> {
  const pixelId = readServerEnv('NEXT_PUBLIC_META_PIXEL_ID')
  const accessToken = readServerEnv('META_CONVERSIONS_API_TOKEN')
  if (!pixelId || !accessToken) return

  const eventId = params.eventId?.trim() || randomUUID()
  const eventTime = Math.floor(Date.now() / 1000)
  const userData = buildUserData(params)

  const serverEvent: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: eventTime,
    event_id: eventId,
    event_source_url: params.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
  }

  if (params.eventName === 'Purchase') {
    if (params.value != null && params.currency) {
      serverEvent.custom_data = {
        value: params.value,
        currency: params.currency,
      }
    }
  }

  const endpoint = `https://graph.facebook.com/v19.0/${pixelId}/events`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [serverEvent],
        access_token: accessToken,
      }),
    })

    if (!response.ok) {
      await response.text().catch(() => undefined)
    }
  } catch {
    // Never break caller flows on Meta API errors.
  }
}

export function sendMetaPurchaseEvent(
  params: Omit<SendMetaEventParams, 'eventName' | 'value' | 'currency'> & {
    stripeSessionId: string
    value?: number
    currency?: string
  }
): void {
  void sendMetaEvent({
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
