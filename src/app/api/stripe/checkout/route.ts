import { NextResponse } from 'next/server'
import { getOrganizerBillingConfig } from '@/lib/organizerBilling'
import { loadOwnedDraftEvent } from '@/lib/organizerPublish'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
  if (!url) return 'http://localhost:3000'
  if (url.startsWith('http')) return url.replace(/\/$/, '')
  return `https://${url}`
}

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
  const base = siteUrl()
  const successUrl = `${base}/dashboard/eventos/${event.public_slug}/compartir?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${base}/dashboard/eventos/${event.public_slug}/compartir?checkout=cancelled`

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: config.priceCents,
          product_data: {
            name: config.stripeProductName,
            description: event.public_slug,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      event_id: event.id,
      user_id: user.id,
      public_slug: event.public_slug,
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'No se pudo iniciar el pago' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { error: insertError } = await admin.from('event_payments').insert({
    event_id: event.id,
    user_id: user.id,
    stripe_checkout_session_id: session.id,
    amount_cents: config.priceCents,
    currency: 'eur',
    status: 'pending',
  })

  if (insertError) {
    console.error('event_payments insert', insertError)
  }

  return NextResponse.json({ url: session.url })
}
