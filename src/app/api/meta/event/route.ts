import { NextResponse } from 'next/server'
import {
  isMetaPixelEventName,
  metaRequestContext,
  sendMetaEvent,
  type MetaPixelEventName,
} from '@/lib/meta-conversions-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type MetaEventBody = {
  eventName?: string
  eventSourceUrl?: string
  eventId?: string
  userPhone?: string
  contentName?: string
  value?: number
  currency?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MetaEventBody
    const eventName = body.eventName?.trim()

    if (!eventName || !isMetaPixelEventName(eventName)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const requestContext = metaRequestContext(request)
    const eventSourceUrl = body.eventSourceUrl?.trim() || requestContext.eventSourceUrl

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const typedEventName = eventName as MetaPixelEventName

    await sendMetaEvent({
      eventName: typedEventName,
      eventSourceUrl,
      eventId: body.eventId?.trim(),
      userEmail: user?.email ?? undefined,
      userPhone: body.userPhone?.trim(),
      clientIpAddress: requestContext.clientIpAddress,
      clientUserAgent: requestContext.clientUserAgent,
      contentName: body.contentName?.trim(),
      value: body.value,
      currency: body.currency?.trim(),
    })
  } catch {
    // Silent — never break client flows.
  }

  return NextResponse.json({ ok: true })
}
