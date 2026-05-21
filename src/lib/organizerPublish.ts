import { decidePublishBilling, getOrganizerBillingConfig } from '@/lib/organizerBilling'
import { EVENT_STATUS_ACTIVE, EVENT_STATUS_DRAFT } from '@/lib/eventLifecycle'
import type { SupabaseClient } from '@supabase/supabase-js'

export type DraftEventForPublish = {
  id: string
  user_id: string
  public_slug: string
  status: string | null
}

export async function loadOwnedDraftEvent(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<DraftEventForPublish | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, user_id, public_slug, status')
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  if ((data.status ?? '') !== EVENT_STATUS_DRAFT) return null
  return data as DraftEventForPublish
}

export async function countActiveOrganizedEvents(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', EVENT_STATUS_ACTIVE)

  if (error) return 0
  return count ?? 0
}

export async function publishDraftEventFree(
  supabase: SupabaseClient,
  event: DraftEventForPublish,
  userId: string
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const config = getOrganizerBillingConfig()
  const activeCount = await countActiveOrganizedEvents(supabase, userId)
  const decision = decidePublishBilling(activeCount, config)

  if (decision.requiresPayment) {
    return { ok: false, error: decision.message }
  }

  const { error } = await supabase
    .from('events')
    .update({ status: EVENT_STATUS_ACTIVE })
    .eq('id', event.id)
    .eq('user_id', userId)
    .eq('status', EVENT_STATUS_DRAFT)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, slug: event.public_slug }
}

/** Idempotent: set organized event to active after successful Stripe payment. */
export async function activateOrganizedEventAfterPayment(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: boolean; slug: string | null }> {
  const { data: row } = await supabase
    .from('events')
    .select('public_slug, status')
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) {
    return { ok: false, slug: null }
  }

  if ((row.status ?? '') !== EVENT_STATUS_ACTIVE) {
    const { error } = await supabase
      .from('events')
      .update({ status: EVENT_STATUS_ACTIVE })
      .eq('id', eventId)
      .eq('user_id', userId)

    if (error) {
      return { ok: false, slug: row.public_slug ?? null }
    }
  }

  return { ok: true, slug: row.public_slug ?? null }
}
