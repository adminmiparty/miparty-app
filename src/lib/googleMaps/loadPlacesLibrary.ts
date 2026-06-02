import {
  ensureGoogleMapsAuthFailureLogger,
  logGoogleMapsFailure,
} from '@/lib/googleMaps/googleMapsDiagnostics'

let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null
let bootstrapInstalled = false
let nativeImportLibrary: typeof google.maps.importLibrary | null = null
let lastAuthFailure: Error | null = null

function getApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

function getApiKeyMeta() {
  const key = getApiKey()
  return { apiKeyConfigured: key.length > 0, apiKeyLength: key.length }
}

type MapsNamespace = typeof google.maps & {
  __mipartyMapsInit__?: () => void
}

/**
 * Official dynamic-import bootstrap (see Google Maps JS "Dynamic Library Import").
 * Defines google.maps.importLibrary before the API script loads; do NOT use
 * libraries=places on a bare script tag — that legacy path often leaves
 * importLibrary undefined (import_library_unavailable).
 */
function ensureGoogleMapsImportLibraryBootstrap(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    const error = new Error('browser_only')
    logGoogleMapsFailure('loadPlacesLibrary', 'browser_only', error, getApiKeyMeta())
    return Promise.reject(error)
  }

  ensureGoogleMapsAuthFailureLogger((error) => {
    lastAuthFailure = error
    logGoogleMapsFailure('loadPlacesLibrary', 'gm_authFailure', error, {
      ...getApiKeyMeta(),
      extra: { note: 'window.gm_authFailure callback from Google Maps JS' },
    })
  })

  const existingImportLibrary = window.google?.maps?.importLibrary
  if (typeof existingImportLibrary === 'function' && existingImportLibrary !== bootstrapImportLibrary) {
    nativeImportLibrary = existingImportLibrary.bind(window.google.maps)
    bootstrapInstalled = true
    return Promise.resolve()
  }

  if (bootstrapInstalled && typeof existingImportLibrary === 'function') {
    return Promise.resolve()
  }

  // Drop scripts from the old direct loader (libraries=places) that never expose importLibrary.
  document.querySelectorAll('script[data-miparty-google-maps="1"]').forEach((node) => {
    node.remove()
  })

  const googleRef = window.google ?? (window.google = {} as typeof google)
  const maps = (googleRef.maps ?? (googleRef.maps = {} as typeof google.maps)) as MapsNamespace

  const requestedLibraries = new Set<string>()
  let scriptLoadPromise: Promise<void> | null = null

  const loadMapsApiScript = (): Promise<void> => {
    if (scriptLoadPromise) {
      return scriptLoadPromise
    }

    scriptLoadPromise = new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        key: apiKey,
        v: 'weekly',
      })
      if (requestedLibraries.size > 0) {
        params.set('libraries', [...requestedLibraries].join(','))
      }
      params.set('callback', 'google.maps.__mipartyMapsInit__')

      maps.__mipartyMapsInit__ = () => {
        if (lastAuthFailure) {
          reject(lastAuthFailure)
          return
        }
        const loadedImportLibrary = google.maps.importLibrary
        if (
          typeof loadedImportLibrary === 'function' &&
          loadedImportLibrary !== bootstrapImportLibrary
        ) {
          nativeImportLibrary = loadedImportLibrary.bind(google.maps)
        }
        resolve()
      }

      const script = document.createElement('script')
      script.dataset.mipartyGoogleMaps = '1'
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
      script.async = true
      script.onerror = () => {
        scriptLoadPromise = null
        const error = new Error('script_load_failed')
        logGoogleMapsFailure('loadPlacesLibrary', 'script_load_failed', error, {
          ...getApiKeyMeta(),
          extra: {
            hint: 'Network block, CSP, ad blocker, or invalid script URL',
          },
        })
        reject(error)
      }
      document.head.append(script)
    })

    return scriptLoadPromise
  }

  function bootstrapImportLibrary(library: string) {
    requestedLibraries.add(library)
    return loadMapsApiScript().then(() => {
      const loadedImportLibrary = google.maps.importLibrary
      if (
        !nativeImportLibrary &&
        typeof loadedImportLibrary === 'function' &&
        loadedImportLibrary !== bootstrapImportLibrary
      ) {
        nativeImportLibrary = loadedImportLibrary.bind(google.maps)
      }

      const importLibrary = nativeImportLibrary
      if (!importLibrary) {
        throw new Error('import_library_unavailable')
      }
      return importLibrary(library as 'places')
    })
  }

  maps.importLibrary = bootstrapImportLibrary as typeof google.maps.importLibrary
  bootstrapInstalled = true

  return Promise.resolve()
}

export function hasGoogleMapsApiKey() {
  return getApiKey().length > 0
}

export async function loadGoogleMapsPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  const apiKeyMeta = getApiKeyMeta()

  if (!apiKeyMeta.apiKeyConfigured) {
    const error = new Error('missing_api_key')
    logGoogleMapsFailure('loadPlacesLibrary', 'missing_api_key', error, apiKeyMeta)
    throw error
  }

  if (!placesLibraryPromise) {
    const apiKey = getApiKey()
    placesLibraryPromise = ensureGoogleMapsImportLibraryBootstrap(apiKey)
      .then(async () => {
        if (lastAuthFailure) {
          throw lastAuthFailure
        }
        if (typeof google.maps.importLibrary !== 'function') {
          const error = new Error('import_library_unavailable')
          logGoogleMapsFailure('loadPlacesLibrary', 'import_library_unavailable', error, {
            ...apiKeyMeta,
            extra: {
              hasGoogleObject: Boolean(window.google),
              hasMapsObject: Boolean(window.google?.maps),
              bootstrapInstalled,
              note: 'importLibrary missing after bootstrap; check API key and HTTP referrer restrictions',
            },
          })
          throw error
        }
        try {
          return (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
        } catch (error) {
          logGoogleMapsFailure('loadPlacesLibrary', 'import_library_places', error, apiKeyMeta)
          throw error
        }
      })
      .catch((error) => {
        logGoogleMapsFailure('loadPlacesLibrary', 'load_google_maps_places_library', error, apiKeyMeta)
        placesLibraryPromise = null
        throw error
      })
  }

  return placesLibraryPromise
}
