import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, format } from 'date-fns'
import { EVENT_STATUS_DRAFT } from '@/lib/eventLifecycle'

export function generateDraftInternalSlug() {
  return `borrador-${crypto.randomUUID().slice(0, 8)}`
}

export type DraftPersistInput = {
  userId: string
  draftEventId: string | null
  /** When inserting a new draft row, enforce max draft count first. */
  enforceNewDraftLimit: boolean
  row: {
    child_name: string
    child_birth_date: string | null
    title: string
    event_date: string
    start_time: string
    pickup_time: string | null
    location_name: string
    location_address: string
    google_maps_url: string
    gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool'
    bizum_phone: string | null
    rsvp_deadline_days: number | null
    birthday_number: number | null
    organizer_phone: string
    enable_food_options: boolean
    organizer_notes: string | null
    invitation_theme: string | null
    invitation_image_url: string | null
    invitation_image_fit: 'contain' | 'cover' | null
    invitation_image_position: string | null
    invitation_image_zoom: number | null
    event_type: string
  }
  foodLabels: string[]
}

export type DraftPersistResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string; reason: 'limit' | 'db' }

/**
 * Upserts a draft event row and replaces food options.
 * Internal placeholders may appear in `row` — callers must only use while status is draft.
 */
export async function upsertDraftEvent(
  supabase: SupabaseClient,
  input: DraftPersistInput
): Promise<DraftPersistResult> {
  if (input.enforceNewDraftLimit && !input.draftEventId) {
    const { count, error: countError } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('status', EVENT_STATUS_DRAFT)
    if (!countError && (count ?? 0) >= 2) {
      return { ok: false, error: 'limit', reason: 'limit' }
    }
  }

  const basePayload = {
    ...input.row,
    user_id: input.userId,
    status: EVENT_STATUS_DRAFT,
  }

  let eventId = input.draftEventId

  if (eventId) {
    const { error: updateError } = await supabase
      .from('events')
      .update(basePayload)
      .eq('id', eventId)
      .eq('user_id', input.userId)
    if (updateError) {
      return { ok: false, error: updateError.message, reason: 'db' }
    }
  } else {
    const publicSlug = generateDraftInternalSlug()
    const { data: inserted, error: insertError } = await supabase
      .from('events')
      .insert({ ...basePayload, public_slug: publicSlug })
      .select('id')
      .single()
    if (insertError || !inserted?.id) {
      return { ok: false, error: insertError?.message ?? 'insert', reason: 'db' }
    }
    eventId = inserted.id
  }

  if (!eventId) {
    return { ok: false, error: 'missing event id', reason: 'db' }
  }

  await supabase.from('event_food_options').delete().eq('event_id', eventId)

  if (input.row.enable_food_options && input.foodLabels.length > 0) {
    const { error: foodError } = await supabase.from('event_food_options').insert(
      input.foodLabels.map((label) => ({
        event_id: eventId,
        label,
      }))
    )
    if (foodError) {
      return { ok: false, error: foodError.message, reason: 'db' }
    }
  }

  return { ok: true, eventId }
}

/** Fallback event date when the form date is not yet valid (ISO yyyy-MM-dd). */
export function defaultDraftEventDateIso() {
  return format(addDays(new Date(), 7), 'yyyy-MM-dd')
}
