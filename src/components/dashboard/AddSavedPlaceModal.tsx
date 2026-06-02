'use client'

import { FormEvent, useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { brand } from '@/lib/brand'
import PlacesAutocompleteSearch from '@/components/places/PlacesAutocompleteSearch'
import {
  buildGoogleMapsSearchUrl,
  buildPlaceAddressLine,
  loadSavedPlaces,
  upsertSavedPlaceFromEventLocation,
} from '@/lib/savedPlaces'

type AddSavedPlaceModalProps = {
  userId: string
  inputClassName: string
  onClose: () => void
  onSaved: (places: ReturnType<typeof loadSavedPlaces>) => void
}

export default function AddSavedPlaceModal({
  userId,
  inputClassName,
  onClose,
  onSaved,
}: AddSavedPlaceModalProps) {
  const [useManualLocation, setUseManualLocation] = useState(false)
  const [placeName, setPlaceName] = useState('')
  const [placeStreet, setPlaceStreet] = useState('')
  const [placeNumber, setPlaceNumber] = useState('')
  const [placePostal, setPlacePostal] = useState('')
  const [placeCity, setPlaceCity] = useState('')
  const [placeModalError, setPlaceModalError] = useState<string | null>(null)
  const [placeSaving, setPlaceSaving] = useState(false)
  const [googleFallbackNotice, setGoogleFallbackNotice] = useState<string | null>(null)

  const openManualEntry = useCallback((reason: 'user' | 'fallback') => {
    setUseManualLocation(true)
    setPlaceModalError(null)
    setGoogleFallbackNotice(
      reason === 'fallback'
        ? 'No pudimos cargar Google Maps en este dispositivo. Puedes guardar el lugar manualmente.'
        : null
    )
  }, [])

  const persistAndClose = useCallback(
    (location: {
      location_name: string
      location_address: string
      google_maps_url: string
      location_place_id?: string | null
    }) => {
      upsertSavedPlaceFromEventLocation(userId, location)
      onSaved(loadSavedPlaces(userId))
      onClose()
    },
    [onClose, onSaved, userId]
  )

  const handleGooglePlaceSelected = useCallback(
    (place: {
      placeId: string
      displayName: string
      formattedAddress: string
      mapsUrl: string
    }) => {
      setPlaceSaving(true)
      setPlaceModalError(null)
      persistAndClose({
        location_name: place.displayName,
        location_address: place.formattedAddress,
        google_maps_url: place.mapsUrl,
        location_place_id: place.placeId,
      })
      setPlaceSaving(false)
    },
    [persistAndClose]
  )

  const handleManualSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = placeName.trim()
    const trimmedStreet = placeStreet.trim()
    const trimmedCity = placeCity.trim()

    if (!trimmedName || !trimmedStreet || !trimmedCity) {
      setPlaceModalError('Completa los campos obligatorios.')
      return
    }

    setPlaceSaving(true)
    setPlaceModalError(null)

    const locationAddress = buildPlaceAddressLine(
      trimmedStreet,
      placeNumber,
      placePostal,
      trimmedCity
    )

    persistAndClose({
      location_name: trimmedName,
      location_address: locationAddress,
      google_maps_url: buildGoogleMapsSearchUrl(
        trimmedStreet,
        placeNumber,
        placePostal,
        trimmedCity
      ),
      location_place_id: null,
    })

    setPlaceSaving(false)
  }

  const manualFormCanSave = Boolean(
    placeName.trim() && placeStreet.trim() && placeCity.trim()
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <h2 id="add-place-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
          Añadir lugar
        </h2>

        <div className="mt-4">
          {!useManualLocation ? (
            <PlacesAutocompleteSearch
              idPrefix="add-place"
              inputClassName={inputClassName}
              label="Buscar lugar"
              onPlaceSelected={handleGooglePlaceSelected}
              onRequestManual={openManualEntry}
            />
          ) : (
            <form onSubmit={handleManualSave} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setUseManualLocation(false)
                  setPlaceModalError(null)
                  setGoogleFallbackNotice(null)
                }}
                className="text-sm font-medium text-gray-500 underline hover:text-gray-800"
              >
                Buscar en Google Maps
              </button>

              {googleFallbackNotice ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {googleFallbackNotice}
                </p>
              ) : null}

              <div>
                <label htmlFor="placeName" className="text-sm font-medium text-gray-700">
                  Nombre del lugar
                </label>
                <input
                  id="placeName"
                  type="text"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                  required
                  className={inputClassName}
                  placeholder="Ej. Casa de los abuelos"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="placeStreet" className="text-sm font-medium text-gray-700">
                    Calle
                  </label>
                  <input
                    id="placeStreet"
                    type="text"
                    value={placeStreet}
                    onChange={(event) => setPlaceStreet(event.target.value)}
                    required
                    className={inputClassName}
                    placeholder="Ej. Carrer de França"
                  />
                </div>
                <div>
                  <label htmlFor="placeNumber" className="text-sm font-medium text-gray-700">
                    Número
                  </label>
                  <input
                    id="placeNumber"
                    type="text"
                    inputMode="numeric"
                    value={placeNumber}
                    onChange={(event) => setPlaceNumber(event.target.value)}
                    className={inputClassName}
                    placeholder="Ej. 7"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="placePostal" className="text-sm font-medium text-gray-700">
                    Código postal
                  </label>
                  <input
                    id="placePostal"
                    type="text"
                    inputMode="numeric"
                    value={placePostal}
                    onChange={(event) => setPlacePostal(event.target.value)}
                    className={inputClassName}
                    placeholder="Ej. 07108"
                  />
                </div>
                <div>
                  <label htmlFor="placeCity" className="text-sm font-medium text-gray-700">
                    Ciudad
                  </label>
                  <input
                    id="placeCity"
                    type="text"
                    value={placeCity}
                    onChange={(event) => setPlaceCity(event.target.value)}
                    required
                    className={inputClassName}
                    placeholder="Ej. Sóller"
                  />
                </div>
              </div>

              {placeModalError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {placeModalError}
                </p>
              ) : null}

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={!manualFormCanSave || placeSaving}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    manualFormCanSave && !placeSaving ? brand.buttonPrimary : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {placeSaving ? 'Guardando…' : 'Guardar lugar'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        {placeSaving && !useManualLocation ? (
          <p className="mt-3 text-center text-sm text-gray-500">Guardando lugar…</p>
        ) : null}
      </div>
    </div>
  )
}
