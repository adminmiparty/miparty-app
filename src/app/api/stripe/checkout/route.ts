import { NextResponse } from 'next/server'
import { logPaymentConfigFlags } from '@/lib/envServer'
import { getOrganizerBillingConfig } from '@/lib/organizerBilling'
import { getRequestHostDiagnostics, getRequestOrigin } from '@/lib/requestOrigin'
import { loadOwnedDraftEvent } from '@/lib/organizerPublish'
import { initStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    const hostDiag = getRequestHostDiagnostics(request)

    if (userError || !user) {
      console.warn('[stripe/checkout] unauthorized', {
        ...hostDiag,
        userError: userError?.message ?? null,
      })
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

    const configFlags = logPaymentConfigFlags('stripe/checkout')
    console.log('[stripe/checkout] start', {
      eventId,
      userId: user.id,
      hasUser: true,
      ...hostDiag,
      configFlags,
    })

    const event = await loadOwnedDraftEvent(supabase, eventId, user.id)
    if (!event) {
      console.warn('[stripe/checkout] draft not found', { eventId, userId: user.id })
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })
    }

    const config = getOrganizerBillingConfig()
    const base = getRequestOrigin(request)
    const successUrl = `${base}/dashboard/eventos/${event.public_slug}/compartir?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${base}/dashboard/eventos/${event.public_slug}/compartir?checkout=cancelled`
    console.log('[stripe/checkout] redirect urls', {
      base,
      envSiteUrl: hostDiag.envSiteUrl,
      requestHost: hostDiag.host,
    })

    const stripeInit = initStripe()
    if (!stripeInit.ok) {
      console.error('[stripe/checkout] stripe not configured', {
        reason: stripeInit.reason,
        configFlags,
      })
      return NextResponse.json(
        { error: 'El pago no está configurado todavía. Inténtalo más tarde.' },
        { status: 503 }
      )
    }
    const stripe = stripeInit.stripe

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
      console.error('[stripe/checkout] session missing url', { sessionId: session.id })
      return NextResponse.json({ error: 'No se pudo iniciar el pago' }, { status: 500 })
    }

    try {
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
        console.error('[stripe/checkout] event_payments insert', insertError.message)
      }
    } catch (adminErr) {
      console.error(
        '[stripe/checkout] admin client unavailable',
        adminErr instanceof Error ? adminErr.message : adminErr
      )
    }

    console.log('[stripe/checkout] session created', {
      sessionId: session.id,
      eventId: event.id,
      ...hostDiag,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] unhandled', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo iniciar el pago' }, { status: 500 })
  }
}
