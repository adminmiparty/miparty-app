import type { SupabaseClient } from '@supabase/supabase-js'

export type SavedPlace = {
  id: string
  location_name: string
  location_address: string
  google_maps_url: string
  street: string
  number: string
  postal: string
  city: string
}

export type DashboardLocationCard = {
  location_name: string
  location_address: string | null
  google_maps_url: string | null
  /** Set when this row includes a manually saved place (localStorage / future DB). */
  saved_place_id: string | null
  /** True if at least one event uses this location name. */
  from_events: boolean
}

const STORAGE_PREFIX = 'miparty_saved_places_'

export function buildPlaceAddressLine(
  street: string,
  number: string,
  postal: string,
  city: string
): string {
  const streetLine = [street.trim(), number.trim()].filter(Boolean).join(' ')
  const cityLine = [postal.trim(), city.trim()].filter(Boolean).join(' ')
  if (streetLine && cityLine) {
    return `${streetLine}, ${cityLine}`
  }
  return streetLine || cityLine
}

/** Google Maps search query from address fields only (excludes place name). */
export function buildGoogleMapsSearchUrl(
  street: string,
  number: string,
  postal: string,
  city: string
): string {
  const query = [street.trim(), number.trim(), postal.trim(), city.trim()].filter(Boolean).join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function loadSavedPlaces(userId: string): SavedPlace[] {
  if (typeof window === 'undefined' || !userId) {
    return []
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is SavedPlace =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedPlace).id === 'string' &&
        typeof (item as SavedPlace).location_name === 'string'
    )
  } catch {
    return []
  }
}

export function persistSavedPlaces(userId: string, places: SavedPlace[]) {
  if (typeof window === 'undefined' || !userId) {
    return
  }
  window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(places))
}

export function mergeEventAndSavedLocations(
  events: Array<{
    location_name: string | null
    location_address: string | null
    google_maps_url: string | null
  }>,
  savedPlaces: SavedPlace[]
): DashboardLocationCard[] {
  const m = new Map<string, DashboardLocationCard>()

  for (const e of events) {
    const n = e.location_name?.trim()
    if (!n) continue
    const address = e.location_address?.trim() ?? null
    const mapsUrl = e.google_maps_url?.trim() || null
    const existing = m.get(n)
    if (!existing) {
      m.set(n, {
        location_name: n,
        location_address: address,
        google_maps_url: mapsUrl,
        saved_place_id: null,
        from_events: true,
      })
      continue
    }
    if (!existing.location_address && address) {
      existing.location_address = address
    }
    if (!existing.google_maps_url && mapsUrl) {
      existing.google_maps_url = mapsUrl
    }
  }

  for (const place of savedPlaces) {
    const n = place.location_name.trim()
    if (!n) continue
    const existing = m.get(n)
    if (existing) {
      m.set(n, {
        location_name: n,
        location_address: place.location_address,
        google_maps_url: place.google_maps_url,
        saved_place_id: place.id,
        from_events: existing.from_events,
      })
    } else {
      m.set(n, {
        location_name: n,
        location_address: place.location_address,
        google_maps_url: place.google_maps_url,
        saved_place_id: place.id,
        from_events: false,
      })
    }
  }

  return [...m.values()]
}

/**
 * Deletes a row from `saved_places` when that table exists (ignored otherwise).
 * Local state should still be updated after calling this.
 */
export async function tryDeleteSavedPlaceRemote(
  supabase: SupabaseClient,
  userId: string,
  placeId: string
): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('id', placeId)
  if (!error) {
    return
  }
  const msg = (error.message ?? '').toLowerCase()
  const ignorable =
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('not found') ||
    error.code === '42P01' ||
    error.code === 'PGRST116' ||
    error.code === 'PGRST205'
  if (!ignorable && process.env.NODE_ENV === 'development') {
    console.warn('[saved_places] remote delete skipped:', error.message)
  }
}
