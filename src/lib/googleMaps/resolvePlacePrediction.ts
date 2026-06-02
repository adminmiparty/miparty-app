import { buildGoogleMapsPlaceUrl } from '@/lib/eventLocation'
import { loadGoogleMapsPlacesLibrary } from '@/lib/googleMaps/loadPlacesLibrary'

export type ResolvedGooglePlace = {
  placeId: string
  displayName: string
  formattedAddress: string
  mapsUrl: string
}

export async function resolvePlacePrediction(
  prediction: google.maps.places.PlacePrediction,
  fallbackDisplayName = ''
): Promise<ResolvedGooglePlace> {
  const place = prediction.toPlace()
  await place.fetchFields({
    fields: ['id', 'displayName', 'formattedAddress', 'googleMapsURI'],
  })

  const placeId = place.id?.trim() ?? ''
  const displayName =
    typeof place.displayName === 'string'
      ? place.displayName
      : ((place.displayName as { text?: string } | undefined)?.text ?? fallbackDisplayName).trim()
  const formattedAddress = place.formattedAddress?.trim() ?? ''
  const mapsUrl = place.googleMapsURI?.trim() || (placeId ? buildGoogleMapsPlaceUrl(placeId) : '')

  if (!placeId || !displayName || !formattedAddress) {
    throw new Error('incomplete_place')
  }

  return { placeId, displayName, formattedAddress, mapsUrl }
}

export async function createPlacesSessionToken() {
  const library = await loadGoogleMapsPlacesLibrary()
  return new library.AutocompleteSessionToken()
}
