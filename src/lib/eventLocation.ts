export function parseStoredLocationAddress(address: string) {
  const segments = address.split(',').map((part) => part.trim())
  if (segments.length >= 2) {
    const street = segments[0] ?? ''
    const tail = segments.slice(1).join(', ').trim()
    const tailMatch = tail.match(/^(\S+)\s+(.+)$/)
    if (tailMatch) {
      return { street, postal: tailMatch[1], city: tailMatch[2] }
    }
    return { street, postal: '', city: tail }
  }
  return { street: address.trim(), postal: '', city: '' }
}

export type EventLocationFormState = {
  useManualLocation: boolean
  locationPlaceId: string
  locationName: string
  locationFormattedAddress: string
  locationStreet: string
  locationCity: string
  locationPostal: string
  googleMapsUrl: string
}

export type ResolvedEventLocation = {
  location_name: string
  location_address: string
  google_maps_url: string
  location_place_id: string | null
}

export function buildGoogleMapsPlaceUrl(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`
}

export function buildManualGoogleMapsSearchUrl(street: string, postal: string, city: string) {
  const query = encodeURIComponent(`${street}, ${postal} ${city}, Spain`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

export function validateEventLocation(state: EventLocationFormState): string | null {
  const name = state.locationName.trim()

  if (!name) {
    return 'El nombre del lugar es obligatorio.'
  }

  if (!state.useManualLocation && state.locationPlaceId) {
    if (!state.locationFormattedAddress.trim()) {
      return 'Selecciona un lugar de la lista o introduce la dirección manualmente.'
    }
    return null
  }

  if (!state.locationStreet.trim() || !state.locationCity.trim() || !state.locationPostal.trim()) {
    return 'La dirección, la ciudad y el código postal son obligatorios, o selecciona un lugar de Google Maps.'
  }

  return null
}

export function resolveEventLocationForSave(state: EventLocationFormState): ResolvedEventLocation {
  const trimmedName = state.locationName.trim()

  if (!state.useManualLocation && state.locationPlaceId.trim()) {
    const placeId = state.locationPlaceId.trim()
    const formatted = state.locationFormattedAddress.trim()
    const mapsUrl = state.googleMapsUrl.trim() || buildGoogleMapsPlaceUrl(placeId)
    return {
      location_name: trimmedName,
      location_address: formatted,
      google_maps_url: mapsUrl,
      location_place_id: placeId,
    }
  }

  const street = state.locationStreet.trim()
  const postal = state.locationPostal.trim()
  const city = state.locationCity.trim()
  const combinedAddress = `${street}, ${postal} ${city}`

  return {
    location_name: trimmedName,
    location_address: combinedAddress,
    google_maps_url:
      state.googleMapsUrl.trim() || buildManualGoogleMapsSearchUrl(street, postal, city),
    location_place_id: null,
  }
}

export function initEventLocationFromStored(
  locationName: string | null | undefined,
  locationAddress: string | null | undefined,
  googleMapsUrl: string | null | undefined,
  locationPlaceId: string | null | undefined
): EventLocationFormState {
  const trimmedPlaceId = locationPlaceId?.trim() ?? ''

  if (trimmedPlaceId) {
    return {
      useManualLocation: false,
      locationPlaceId: trimmedPlaceId,
      locationName: locationName?.trim() ?? '',
      locationFormattedAddress: locationAddress?.trim() ?? '',
      locationStreet: '',
      locationCity: '',
      locationPostal: '',
      googleMapsUrl: googleMapsUrl?.trim() ?? '',
    }
  }

  const parsed = parseStoredLocationAddress(locationAddress ?? '')
  return {
    useManualLocation: true,
    locationPlaceId: '',
    locationName: locationName?.trim() ?? '',
    locationFormattedAddress: '',
    locationStreet: parsed.street,
    locationCity: parsed.city,
    locationPostal: parsed.postal,
    googleMapsUrl: googleMapsUrl?.trim() ?? '',
  }
}

export function getEventLocationFormState(input: {
  useManualLocation: boolean
  locationPlaceId: string
  locationName: string
  locationFormattedAddress: string
  locationStreet: string
  locationCity: string
  locationPostal: string
  googleMapsUrl: string
}): EventLocationFormState {
  return { ...input }
}
