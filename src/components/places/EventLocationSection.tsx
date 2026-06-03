'use client'

import { useCallback } from 'react'
import { MapPin, Pencil } from 'lucide-react'
import PlacesAutocompleteSearch from '@/components/places/PlacesAutocompleteSearch'
import type { ResolvedGooglePlace } from '@/lib/googleMaps/resolvePlacePrediction'
import { hasGoogleMapsApiKey } from '@/lib/googleMaps/loadPlacesLibrary'

export type EventLocationSectionProps = {
  idPrefix?: string
  inputFocusClass: string
  useManualLocation: boolean
  setUseManualLocation: (value: boolean) => void
  locationPlaceId: string
  setLocationPlaceId: (value: string) => void
  locationName: string
  setLocationName: (value: string) => void
  locationFormattedAddress: string
  setLocationFormattedAddress: (value: string) => void
  locationStreet: string
  setLocationStreet: (value: string) => void
  locationCity: string
  setLocationCity: (value: string) => void
  locationPostal: string
  setLocationPostal: (value: string) => void
  googleMapsUrl: string
  setGoogleMapsUrl: (value: string) => void
}

export default function EventLocationSection({
  idPrefix = 'event-location',
  inputFocusClass,
  useManualLocation,
  setUseManualLocation,
  locationPlaceId,
  setLocationPlaceId,
  locationName,
  setLocationName,
  locationFormattedAddress,
  setLocationFormattedAddress,
  locationStreet,
  setLocationStreet,
  locationCity,
  setLocationCity,
  locationPostal,
  setLocationPostal,
  googleMapsUrl,
  setGoogleMapsUrl,
}: EventLocationSectionProps) {
  const hasSelectedGooglePlace =
    !useManualLocation && Boolean(locationPlaceId && locationName.trim() && locationFormattedAddress.trim())

  const inputClassName = `w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${inputFocusClass}`

  const switchToManual = useCallback(() => {
    setUseManualLocation(true)
    setLocationPlaceId('')
  }, [setLocationPlaceId, setUseManualLocation])

  const handleRequestManual = useCallback(
    (reason: 'user' | 'fallback') => {
      if (reason === 'user') {
        switchToManual()
      }
    },
    [switchToManual]
  )

  const hasManualDraft =
    !locationPlaceId.trim() &&
    Boolean(locationName.trim()) &&
    Boolean(locationStreet.trim() || locationCity.trim())

  const switchToGoogleSearch = useCallback(() => {
    setUseManualLocation(false)
    setLocationStreet('')
    setLocationCity('')
    setLocationPostal('')
  }, [setLocationCity, setLocationPostal, setLocationStreet, setUseManualLocation])

  const handlePlaceSelected = useCallback(
    (place: ResolvedGooglePlace) => {
      setUseManualLocation(false)
      setLocationPlaceId(place.placeId)
      setLocationName(place.displayName)
      setLocationFormattedAddress(place.formattedAddress)
      setGoogleMapsUrl(place.mapsUrl)
      setLocationStreet('')
      setLocationCity('')
      setLocationPostal('')
    },
    [
      setGoogleMapsUrl,
      setLocationCity,
      setLocationFormattedAddress,
      setLocationName,
      setLocationPlaceId,
      setLocationPostal,
      setLocationStreet,
      setUseManualLocation,
    ]
  )

  const clearGoogleSelection = () => {
    setLocationPlaceId('')
    setLocationName('')
    setLocationFormattedAddress('')
    setGoogleMapsUrl('')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Ubicación</h2>

      {!useManualLocation ? (
        <div className="space-y-3">
          {hasSelectedGooglePlace ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{locationName}</p>
                  <p className="mt-1 text-sm text-gray-600">{locationFormattedAddress}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearGoogleSelection}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 underline hover:text-gray-900"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Cambiar lugar
              </button>
            </div>
          ) : (
            <>
              {hasManualDraft ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  Ubicación guardada: <span className="font-medium text-gray-900">{locationName}</span>
                  {locationStreet.trim() ? (
                    <>
                      {' '}
                      — {locationStreet.trim()}
                      {locationPostal.trim() || locationCity.trim()
                        ? `, ${[locationPostal.trim(), locationCity.trim()].filter(Boolean).join(' ')}`
                        : ''}
                    </>
                  ) : null}
                  .{' '}
                  <button
                    type="button"
                    onClick={switchToManual}
                    className="font-medium text-gray-700 underline hover:text-gray-900"
                  >
                    Editar manualmente
                  </button>
                </p>
              ) : null}
              <PlacesAutocompleteSearch
                idPrefix={idPrefix}
                inputClassName={inputClassName}
                label="Buscar lugar *"
                onPlaceSelected={handlePlaceSelected}
                onRequestManual={handleRequestManual}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor={`${idPrefix}-name`} className="mb-1.5 block text-sm font-medium text-gray-900">
              Nombre del lugar *
            </label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              required
              placeholder="Ej. Parque del barrio"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-street`} className="mb-1.5 block text-sm font-medium text-gray-900">
              Dirección *
            </label>
            <input
              id={`${idPrefix}-street`}
              type="text"
              value={locationStreet}
              onChange={(event) => setLocationStreet(event.target.value)}
              required
              placeholder="Calle y número"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idPrefix}-city`} className="mb-1.5 block text-sm font-medium text-gray-900">
                Ciudad *
              </label>
              <input
                id={`${idPrefix}-city`}
                type="text"
                value={locationCity}
                onChange={(event) => setLocationCity(event.target.value)}
                required
                placeholder="Ej. Madrid"
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-postal`} className="mb-1.5 block text-sm font-medium text-gray-900">
                Código postal *
              </label>
              <input
                id={`${idPrefix}-postal`}
                type="text"
                value={locationPostal}
                onChange={(event) => setLocationPostal(event.target.value)}
                required
                placeholder="00000 si no aplica"
                className={inputClassName}
              />
            </div>
          </div>

          {hasGoogleMapsApiKey() ? (
            <button
              type="button"
              onClick={switchToGoogleSearch}
              className="text-sm font-medium text-gray-500 underline hover:text-gray-800"
            >
              Buscar en Google Maps
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
