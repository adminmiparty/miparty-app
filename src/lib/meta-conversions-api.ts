import { createHash, randomUUID } from 'crypto'
import { readServerEnv } from '@/lib/envServer'

/** Standard Meta Pixel events sent through the Conversions API gateway. */
export const META_PIXEL_EVENT_NAMES = [
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'Schedule',
  'InitiateCheckout',
  'Purchase',
] as const

export type MetaPixelEventName = (typeof META_PIXEL_EVENT_NAMES)[number]

/** @deprecated Use MetaPixelEventName */
export type MetaServerEventName = MetaPixelEventName

/** @deprecated Use META_PIXEL_EVENT_NAMES */
export const META_SERVER_EVENT_NAMES = META_PIXEL_EVENT_NAMES

export type SendMetaEventParams = {
  eventName: MetaPixelEventName
  eventSourceUrl: string
  eventId?: string
  userEmail?: string
  userPhone?: string
  clientIpAddress?: string
  clientUserAgent?: string
  contentName?: string
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

function buildCustomData(params: SendMetaEventParams): Record<string, string | number> | undefined {
  if (params.eventName === 'Purchase') {
    if (params.value == null || !params.currency) return undefined
    return { value: params.value, currency: params.currency }
  }

  if (params.eventName === 'ViewContent' || params.eventName === 'Lead') {
    const contentName = params.contentName?.trim()
    if (!contentName) return undefined
    return { content_name: contentName }
  }

  return undefined
}

export function isMetaPixelEventName(value: string): value is MetaPixelEventName {
  return (META_PIXEL_EVENT_NAMES as readonly string[]).includes(value)
}

/** @deprecated Use isMetaPixelEventName */
export function isMetaServerEventName(value: string): value is MetaPixelEventName {
  return isMetaPixelEventName(value)
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
  const customData = buildCustomData(params)

  const serverEvent: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: eventTime,
    event_id: eventId,
    event_source_url: params.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
  }

  if (customData) {
    serverEvent.custom_data = customData
  }

  const endpoint = `https://graph.facebook.com/v19.0/${pixelId}/events`
  const testEventCode = readServerEnv('META_PIXEL_TEST_EVENT_CODE')

  const requestBody: Record<string, unknown> = {
    data: [serverEvent],
    access_token: accessToken,
  }
  if (testEventCode) {
    requestBody.test_event_code = testEventCode
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
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
    value: params.value ?? 2.99,
    currency: params.currency ?? 'EUR',
  })
}
