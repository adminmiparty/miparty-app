import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { logPaymentConfigFlags, readServerEnv } from '@/lib/envServer'
import { EVENT_STATUS_ACTIVE, EVENT_STATUS_DRAFT } from '@/lib/eventLifecycle'
import { initStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const configFlags = logPaymentConfigFlags('stripe/webhook')
  const stripeInit = initStripe()
  if (!stripeInit.ok) {
    console.error('[stripe/webhook] stripe not configured', {
      reason: stripeInit.reason,
      configFlags,
    })
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 })
  }
  const stripe = stripeInit.stripe
  const webhookSecret = readServerEnv('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('[stripe/webhook] missing STRIPE_WEBHOOK_SECRET', { configFlags })
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Firma ausente' }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const eventId = session.metadata?.event_id
    const userId = session.metadata?.user_id

    if (eventId && userId) {
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

      await admin
        .from('events')
        .update({ status: EVENT_STATUS_ACTIVE })
        .eq('id', eventId)
        .eq('user_id', userId)
        .eq('status', EVENT_STATUS_DRAFT)
    }
  }

  return NextResponse.json({ received: true })
}
