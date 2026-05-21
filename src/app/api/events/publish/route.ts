import { NextResponse } from 'next/server'
import { decidePublishBilling, getOrganizerBillingConfig } from '@/lib/organizerBilling'
import { countActiveOrganizedEvents, loadOwnedDraftEvent, publishDraftEventFree } from '@/lib/organizerPublish'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { eventId?: string }
  try {
    body = (await request.json()) as { eventId?: string }
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const eventId = body.eventId?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'Falta el evento' }, { status: 400 })
  }

  const event = await loadOwnedDraftEvent(supabase, eventId, user.id)
  if (!event) {
    return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })
  }

  const config = getOrganizerBillingConfig()
  const activeCount = await countActiveOrganizedEvents(supabase, user.id)
  const decision = decidePublishBilling(activeCount, config)

  if (decision.requiresPayment) {
    return NextResponse.json({
      published: false,
      requiresPayment: true,
      message: decision.message,
      priceLabel: config.priceLabel,
    })
  }

  const result = await publishDraftEventFree(supabase, event, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    published: true,
    requiresPayment: false,
    slug: result.slug,
    message: decision.message,
  })
}
