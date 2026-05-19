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
      m.set(n, { location_name: n, location_address: address, google_maps_url: mapsUrl })
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
    m.set(n, {
      location_name: n,
      location_address: place.location_address,
      google_maps_url: place.google_maps_url,
    })
  }

  return [...m.values()]
}
