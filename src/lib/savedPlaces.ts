import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStoredLocationAddress } from '@/lib/eventLocation'

export type SavedPlace = {
  id: string
  location_name: string
  location_address: string
  google_maps_url: string
  street: string
  number: string
  postal: string
  city: string
  location_place_id?: string
}

export type EventLocationForSavedPlace = {
  location_name: string
  location_address: string
  google_maps_url: string
  location_place_id?: string | null
}

const DRAFT_LOCATION_ADDRESS_PLACEHOLDER = '\u2014, \u2014 \u2014'

export function isPlaceholderLocationName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed === '' || trimmed === '\u2014' || trimmed === '—'
}

export function isPlaceholderLocationAddress(address: string): boolean {
  const trimmed = address.trim()
  if (!trimmed) {
    return true
  }
  if (trimmed === DRAFT_LOCATION_ADDRESS_PLACEHOLDER) {
    return true
  }
  return /^[\u2014—\s,]+$/.test(trimmed)
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
const DISMISSED_PREFIX = 'miparty_dismissed_locations_'

export function loadDismissedLocationNames(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) {
    return []
  }
  try {
    const raw = window.localStorage.getItem(`${DISMISSED_PREFIX}${userId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

export function persistDismissedLocationNames(userId: string, names: string[]) {
  if (typeof window === 'undefined' || !userId) {
    return
  }
  window.localStorage.setItem(`${DISMISSED_PREFIX}${userId}`, JSON.stringify(names))
}

export function normalizeLocationNameKey(name: string) {
  return name.trim().toLowerCase()
}

function normalizeAddressKey(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeMapsUrlKey(url: string) {
  return url.trim().toLowerCase()
}

function findMatchingSavedPlaceIndex(
  places: SavedPlace[],
  location: EventLocationForSavedPlace
): number {
  const placeId = location.location_place_id?.trim() ?? ''
  if (placeId) {
    const byPlaceId = places.findIndex((p) => (p.location_place_id?.trim() ?? '') === placeId)
    if (byPlaceId >= 0) {
      return byPlaceId
    }
  }

  const mapsUrl = location.google_maps_url.trim()
  if (mapsUrl) {
    const mapsKey = normalizeMapsUrlKey(mapsUrl)
    const byMaps = places.findIndex(
      (p) => p.google_maps_url.trim() !== '' && normalizeMapsUrlKey(p.google_maps_url) === mapsKey
    )
    if (byMaps >= 0) {
      return byMaps
    }
  }

  const nameKey = normalizeLocationNameKey(location.location_name)
  const addressKey = normalizeAddressKey(location.location_address)
  return places.findIndex(
    (p) =>
      normalizeLocationNameKey(p.location_name) === nameKey &&
      normalizeAddressKey(p.location_address) === addressKey
  )
}

function newSavedPlaceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `place-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Persists event location to local saved places (deduped). Returns current list (SSR/no-op: []). */
export function upsertSavedPlaceFromEventLocation(
  userId: string,
  location: EventLocationForSavedPlace
): SavedPlace[] {
  if (typeof window === 'undefined' || !userId) {
    return []
  }

  const locationName = location.location_name.trim()
  const locationAddress = location.location_address.trim()
  if (isPlaceholderLocationName(locationName) || isPlaceholderLocationAddress(locationAddress)) {
    return loadSavedPlaces(userId)
  }

  const parsed = parseStoredLocationAddress(locationAddress)
  const placeId = location.location_place_id?.trim() ?? ''
  const mapsUrl = location.google_maps_url.trim()

  const places = loadSavedPlaces(userId)
  const matchIndex = findMatchingSavedPlaceIndex(places, {
    location_name: locationName,
    location_address: locationAddress,
    google_maps_url: mapsUrl,
    location_place_id: placeId || null,
  })

  if (matchIndex >= 0) {
    const existing = places[matchIndex]
    places[matchIndex] = {
      ...existing,
      location_name: locationName,
      location_address: locationAddress,
      google_maps_url: mapsUrl || existing.google_maps_url,
      location_place_id: placeId || existing.location_place_id,
      street: parsed.street || existing.street,
      postal: parsed.postal || existing.postal,
      city: parsed.city || existing.city,
    }
  } else {
    places.push({
      id: newSavedPlaceId(),
      location_name: locationName,
      location_address: locationAddress,
      google_maps_url: mapsUrl,
      street: parsed.street,
      number: '',
      postal: parsed.postal,
      city: parsed.city,
      ...(placeId ? { location_place_id: placeId } : {}),
    })
  }

  persistSavedPlaces(userId, places)
  return places
}

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
    if (!n || isPlaceholderLocationName(n)) continue
    const rawAddress = e.location_address?.trim() ?? ''
    const address =
      rawAddress && !isPlaceholderLocationAddress(rawAddress) ? rawAddress : null
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
    if (!n || isPlaceholderLocationName(n)) continue
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

/** Hides dismissed names from the dashboard list without changing events. */
export function filterDashboardLocations(
  locations: DashboardLocationCard[],
  dismissedNames: string[]
): DashboardLocationCard[] {
  if (dismissedNames.length === 0) {
    return locations
  }
  const dismissed = new Set(dismissedNames.map(normalizeLocationNameKey))
  return locations.filter((loc) => !dismissed.has(normalizeLocationNameKey(loc.location_name)))
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
