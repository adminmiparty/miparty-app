import { NextResponse } from 'next/server'
import {
  isMetaServerEventName,
  metaRequestContext,
  sendMetaEvent,
  type MetaServerEventName,
} from '@/lib/meta-conversions-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type MetaEventBody = {
  eventName?: string
  eventSourceUrl?: string
  eventId?: string
  userPhone?: string
  value?: number
  currency?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MetaEventBody
    const eventName = body.eventName?.trim()

    if (!eventName || !isMetaServerEventName(eventName)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const requestContext = metaRequestContext(request)
    const eventSourceUrl = body.eventSourceUrl?.trim() || requestContext.eventSourceUrl

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const typedEventName = eventName as MetaServerEventName

    await sendMetaEvent({
      eventName: typedEventName,
      eventSourceUrl,
      eventId: body.eventId?.trim(),
      userEmail: user?.email ?? undefined,
      userPhone: body.userPhone?.trim(),
      clientIpAddress: requestContext.clientIpAddress,
      clientUserAgent: requestContext.clientUserAgent,
      value: typedEventName === 'Purchase' ? body.value : undefined,
      currency: typedEventName === 'Purchase' ? body.currency : undefined,
    })
  } catch {
    // Silent — never break client flows.
  }

  return NextResponse.json({ ok: true })
}
