'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  createPlacesSessionToken,
  resolvePlacePrediction,
  type ResolvedGooglePlace,
} from '@/lib/googleMaps/resolvePlacePrediction'
import {
  googleMapsFailureUserMessage,
  logGoogleMapsFailure,
  type GoogleMapsFailureKind,
} from '@/lib/googleMaps/googleMapsDiagnostics'
import {
  hasGoogleMapsApiKey,
  loadGoogleMapsPlacesLibrary,
  resetGoogleMapsPlacesLibraryCache,
} from '@/lib/googleMaps/loadPlacesLibrary'

export type { ResolvedGooglePlace }

type PlaceSuggestionItem = {
  id: string
  label: string
  placePrediction: google.maps.places.PlacePrediction
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export type PlacesAutocompleteSearchProps = {
  idPrefix?: string
  inputClassName: string
  label?: string
  placeholder?: string
  onPlaceSelected: (place: ResolvedGooglePlace) => void
  onRequestManual: (reason: 'user' | 'fallback') => void
}

export default function PlacesAutocompleteSearch({
  idPrefix = 'places-search',
  inputClassName,
  label = 'Buscar lugar',
  placeholder = 'Ej. Burger King Marbella, Parque de la Constitución…',
  onPlaceSelected,
  onRequestManual,
}: PlacesAutocompleteSearchProps) {
  const listboxId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const requestSeqRef = useRef(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectingPlace, setSelectingPlace] = useState(false)
  const [placesReady, setPlacesReady] = useState(false)
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [loadFailureKind, setLoadFailureKind] = useState<GoogleMapsFailureKind | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  const debouncedQuery = useDebouncedValue(searchQuery, 280)

  const logPlacesFallbackError = useCallback(
    (stage: string, error: unknown, extra?: Record<string, unknown>) =>
      logGoogleMapsFailure('PlacesAutocompleteSearch', stage, error, {
        manualFallback: true,
        apiKeyConfigured: hasGoogleMapsApiKey(),
        apiKeyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim().length ?? 0,
        extra,
      }),
    []
  )

  const ensureSessionToken = useCallback(async () => {
    const library = await loadGoogleMapsPlacesLibrary()
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new library.AutocompleteSessionToken()
    }
    return library
  }, [])

  useEffect(() => {
    if (!hasGoogleMapsApiKey()) {
      const log = logPlacesFallbackError('missing_api_key', new Error('missing_api_key'))
      setLoadFailureKind(log.failureKind)
      setPlacesError(googleMapsFailureUserMessage(log.failureKind))
      setPlacesReady(false)
      return
    }

    let cancelled = false
    setPlacesReady(false)
    setLoadFailureKind(null)
    setPlacesError(null)

    void loadGoogleMapsPlacesLibrary()
      .then(() => {
        if (!cancelled) {
          setPlacesReady(true)
          setPlacesError(null)
          setLoadFailureKind(null)
        }
      })
      .catch((error) => {
        const log = logPlacesFallbackError('load_google_places_library', error)
        if (!cancelled) {
          setLoadFailureKind(log.failureKind)
          setPlacesError(googleMapsFailureUserMessage(log.failureKind))
          setPlacesReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadAttempt, logPlacesFallbackError])

  useEffect(() => {
    const query = debouncedQuery.trim()
    if (query.length < 2) {
      setSuggestions([])
      setLoadingSuggestions(false)
      return
    }

    if (!placesReady) {
      return
    }

    const requestId = ++requestSeqRef.current
    setLoadingSuggestions(true)

    void (async () => {
      try {
        const library = await ensureSessionToken()
        const { suggestions: rawSuggestions } =
          await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: sessionTokenRef.current ?? undefined,
            includedRegionCodes: ['es'],
            language: 'es',
          })

        if (requestId !== requestSeqRef.current) return

        const next = rawSuggestions
          .map((item, index) => {
            const prediction = item.placePrediction
            const suggestionLabel = prediction?.text?.text?.trim() ?? ''
            if (!prediction || !suggestionLabel) return null
            return {
              id: `${index}-${suggestionLabel}`,
              label: suggestionLabel,
              placePrediction: prediction,
            }
          })
          .filter((item): item is PlaceSuggestionItem => item != null)
          .slice(0, 6)

        setSuggestions(next)
        setSuggestionsOpen(next.length > 0)
      } catch (error) {
        logPlacesFallbackError('fetch_autocomplete_suggestions', error, {
          query,
        })
        if (requestId !== requestSeqRef.current) return
        setSuggestions([])
        setSuggestionsOpen(false)
        setPlacesError('No pudimos obtener sugerencias. Puedes introducir la dirección manualmente.')
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoadingSuggestions(false)
        }
      }
    })()
  }, [debouncedQuery, ensureSessionToken, logPlacesFallbackError, placesReady])

  const handleSelectSuggestion = async (item: PlaceSuggestionItem) => {
    setSelectingPlace(true)
    setSuggestionsOpen(false)
    setPlacesError(null)

    try {
      await ensureSessionToken()
      const resolved = await resolvePlacePrediction(item.placePrediction, searchQuery.trim())
      onPlaceSelected(resolved)
      setSearchQuery('')
      setSuggestions([])
      sessionTokenRef.current = await createPlacesSessionToken()
    } catch (error) {
      logPlacesFallbackError('select_prediction', error, { searchQuery })
      setPlacesError('No pudimos usar ese lugar. Prueba otra búsqueda o introduce la dirección manualmente.')
      setSuggestionsOpen(true)
    } finally {
      setSelectingPlace(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor={`${idPrefix}-search`} className="mb-1.5 block text-sm font-medium text-gray-900">
          {label}
        </label>
        <input
          ref={searchInputRef}
          id={`${idPrefix}-search`}
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setSuggestionsOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setSuggestionsOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => setSuggestionsOpen(false), 180)
          }}
          autoComplete="off"
          enterKeyHint="search"
          disabled={selectingPlace || (!placesReady && !placesError)}
          placeholder={placeholder}
          className={inputClassName}
          role="combobox"
          aria-expanded={suggestionsOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
        {loadingSuggestions || selectingPlace ? (
          <p className="mt-1.5 text-xs text-gray-500">
            {selectingPlace ? 'Cargando lugar…' : 'Buscando…'}
          </p>
        ) : null}
        {suggestionsOpen && suggestions.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          >
            {suggestions.map((item) => (
              <li key={item.id} role="option">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleSelectSuggestion(item)}
                  className="flex w-full items-start gap-2 px-3 py-3 text-left text-sm text-gray-900 transition hover:bg-gray-50 active:bg-gray-100"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!loadingSuggestions &&
        debouncedQuery.trim().length >= 2 &&
        suggestions.length === 0 &&
        placesReady &&
        !selectingPlace ? (
          <p className="mt-1.5 text-xs text-gray-500">
            No encontramos resultados. Puedes{' '}
            <button
              type="button"
              onClick={() => onRequestManual('user')}
              className="font-medium text-gray-700 underline hover:text-gray-900"
            >
              introducir la dirección manualmente
            </button>
            .
          </p>
        ) : null}
      </div>

      {placesError ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-900">{placesError}</p>
          {loadFailureKind && hasGoogleMapsApiKey() ? (
            <button
              type="button"
              onClick={() => {
                resetGoogleMapsPlacesLibraryCache()
                setLoadAttempt((attempt: number) => attempt + 1)
              }}
              className="text-sm font-medium text-amber-900 underline hover:text-amber-950"
            >
              Reintentar búsqueda
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onRequestManual('user')}
        className="text-sm font-medium text-gray-500 underline hover:text-gray-800"
      >
        Introducir dirección manualmente
      </button>
    </div>
  )
}
