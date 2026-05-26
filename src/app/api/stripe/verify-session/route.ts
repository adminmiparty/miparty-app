import { NextResponse } from 'next/server'
import { logPaymentConfigFlags } from '@/lib/envServer'
import { activateOrganizedEventAfterPayment } from '@/lib/organizerPublish'
import { EVENT_STATUS_ACTIVE } from '@/lib/eventLifecycle'
import { isStripeCheckoutPaid } from '@/lib/stripe/checkoutSession'
import { initStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { metaRequestContext, sendMetaPurchaseEvent } from '@/lib/meta-conversions-api'
import { sendTikTokPurchaseEvent, tiktokRequestContext } from '@/lib/tiktok-events-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const sessionId = new URL(request.url).searchParams.get('session_id')?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'Falta session_id' }, { status: 400 })
  }

  const configFlags = logPaymentConfigFlags('stripe/verify-session')
  const stripeInit = initStripe()
  if (!stripeInit.ok) {
    console.error('[stripe/verify-session] stripe not configured', {
      reason: stripeInit.reason,
      configFlags,
    })
    return NextResponse.json({ error: 'Pago no configurado' }, { status: 503 })
  }
  const session = await stripeInit.stripe.checkout.sessions.retrieve(sessionId)

  if (session.metadata?.user_id !== user.id) {
    return NextResponse.json({ error: 'Sesión no válida' }, { status: 403 })
  }

  const eventId = session.metadata?.event_id
  if (!eventId) {
    return NextResponse.json({ error: 'Evento no encontrado en la sesión' }, { status: 400 })
  }

  const paid = isStripeCheckoutPaid(session)

  if (paid) {
    try {
      const admin = createAdminClient()
      const paidAt = new Date().toISOString()

      await admin
        .from('event_payments')
        .update({
          status: 'paid',
          paid_at: paidAt,
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .eq('stripe_checkout_session_id', session.id)

      const activated = await activateOrganizedEventAfterPayment(admin, eventId, user.id)
      console.info('[stripe/verify-session] activated', {
        eventId,
        ok: activated.ok,
        slug: activated.slug,
      })
    } catch (err) {
      console.error(
        '[stripe/verify-session] post-payment update failed',
        err instanceof Error ? err.message : err
      )
    }
  }

  const { data: eventRow } = await supabase
    .from('events')
    .select('public_slug, status')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  const published = eventRow?.status === EVENT_STATUS_ACTIVE

  if (paid && published) {
    const metaContext = metaRequestContext(request, '/dashboard/eventos')
    sendMetaPurchaseEvent({
      stripeSessionId: sessionId,
      eventSourceUrl: metaContext.eventSourceUrl,
      userEmail: user.email ?? undefined,
      clientIpAddress: metaContext.clientIpAddress,
      clientUserAgent: metaContext.clientUserAgent,
    })

    const tiktokContext = tiktokRequestContext(request, '/dashboard/eventos')
    sendTikTokPurchaseEvent({
      stripeSessionId: sessionId,
      eventSourceUrl: tiktokContext.eventSourceUrl,
      userEmail: user.email ?? undefined,
      clientIpAddress: tiktokContext.clientIpAddress,
      clientUserAgent: tiktokContext.clientUserAgent,
    })
  }

  return NextResponse.json({
    paid,
    published,
    slug: eventRow?.public_slug ?? session.metadata?.public_slug ?? null,
  })
}
