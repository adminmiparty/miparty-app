import {
  ensureGoogleMapsAuthFailureLogger,
  logGoogleMapsFailure,
} from '@/lib/googleMaps/googleMapsDiagnostics'

let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null
let lastAuthFailure: Error | null = null
let productionEnvDiagnosticLogged = false

function getApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

function getApiKeyMeta() {
  const key = getApiKey()
  return { apiKeyConfigured: key.length > 0, apiKeyLength: key.length }
}

/** Temporary: verify NEXT_PUBLIC_* inlined at build time (remove after prod check). */
function logProductionGoogleMapsEnvDiagnostic() {
  if (typeof window === 'undefined' || productionEnvDiagnosticLogged) {
    return
  }
  productionEnvDiagnosticLogged = true

  console.log('[GoogleMaps][env]', {
    googleMapsConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    googleMapsKeyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length ?? 0,
    hasGoogleMapsApiKey: getApiKey().length > 0,
    googleMapsKeyLengthTrimmed: getApiKey().length,
  })
}

type GoogleMapsBootstrapOptions = {
  key: string
  v: string
  language?: string
  region?: string
  authReferrerPolicy?: 'origin'
}

/**
 * Google's official dynamic-import bootstrap (Maps JavaScript API docs).
 * Do not use a bare script tag with libraries=places — that leaves importLibrary undefined.
 */
function installGoogleMapsDynamicLoader(options: GoogleMapsBootstrapOptions): void {
  const g = options
  ;(
    (loaderOptions: GoogleMapsBootstrapOptions) => {
      let scriptLoadPromise: Promise<void> | null = null
      let scriptEl: HTMLScriptElement | null = null
      const apiName = 'The Google Maps JavaScript API'
      const googleNamespace = 'google'
      const importLibraryName = 'importLibrary'
      const initCallbackName = '__ib__'
      const doc = document
      const win = window as Window & typeof globalThis
      const googleRef =
        ((win as unknown as Record<string, unknown>)[googleNamespace] as
          | Record<string, unknown>
          | undefined) ??
        (((win as unknown as Record<string, unknown>)[googleNamespace] = {}) as Record<
          string,
          unknown
        >)
      const mapsRef =
        (googleRef.maps as Record<string, unknown> | undefined) ??
        ((googleRef.maps = {}) as Record<string, unknown>)
      const requestedLibraries = new Set<string>()
      const searchParams = new URLSearchParams()

      const loadScript = () =>
        scriptLoadPromise ??
        (scriptLoadPromise = new Promise<void>((resolve, reject) => {
          void (async () => {
            scriptEl = doc.createElement('script')
            searchParams.set('libraries', [...requestedLibraries].join(','))
            for (const key of Object.keys(loaderOptions) as (keyof GoogleMapsBootstrapOptions)[]) {
              const value = loaderOptions[key]
              if (value == null || value === '') continue
              const paramKey = key.replace(/[A-Z]/g, (letter) => `_${letter[0].toLowerCase()}`)
              searchParams.set(paramKey, String(value))
            }
            searchParams.set('callback', `${googleNamespace}.maps.${initCallbackName}`)
            scriptEl.src = `https://maps.googleapis.com/maps/api/js?${searchParams}`
            mapsRef[initCallbackName] = resolve
            scriptEl.onerror = () => {
              scriptLoadPromise = null
              reject(new Error(`${apiName} could not load.`))
            }
            const nonceScript = doc.querySelector('script[nonce]')
            if (nonceScript instanceof HTMLScriptElement && nonceScript.nonce) {
              scriptEl.nonce = nonceScript.nonce
            }
            doc.head.append(scriptEl)
          })()
        }))

      if (typeof mapsRef[importLibraryName] === 'function') {
        console.warn(`${apiName} only loads once. Ignoring:`, loaderOptions)
        return
      }

      mapsRef[importLibraryName] = (library: string) =>
        requestedLibraries.add(library) &&
        loadScript().then(() =>
          (mapsRef[importLibraryName] as typeof google.maps.importLibrary)(
            library as 'places'
          )
        )
    }
  )(g)
}

/** Clears cached library load (e.g. after user taps Reintentar). */
export function resetGoogleMapsPlacesLibraryCache() {
  placesLibraryPromise = null
  lastAuthFailure = null
}

export function hasGoogleMapsApiKey() {
  logProductionGoogleMapsEnvDiagnostic()
  return getApiKey().length > 0
}

export async function loadGoogleMapsPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  logProductionGoogleMapsEnvDiagnostic()
  const apiKeyMeta = getApiKeyMeta()

  if (!apiKeyMeta.apiKeyConfigured) {
    const error = new Error('missing_api_key')
    logGoogleMapsFailure('loadPlacesLibrary', 'missing_api_key', error, apiKeyMeta)
    throw error
  }

  if (typeof window === 'undefined') {
    const error = new Error('browser_only')
    logGoogleMapsFailure('loadPlacesLibrary', 'browser_only', error, apiKeyMeta)
    throw error
  }

  ensureGoogleMapsAuthFailureLogger((error) => {
    lastAuthFailure = error
    logGoogleMapsFailure('loadPlacesLibrary', 'gm_authFailure', error, {
      ...apiKeyMeta,
      extra: { note: 'window.gm_authFailure callback from Google Maps JS' },
    })
    resetGoogleMapsPlacesLibraryCache()
  })

  document.querySelectorAll('script[data-miparty-google-maps="1"]').forEach((node) => {
    node.remove()
  })

  if (!placesLibraryPromise) {
    const apiKey = getApiKey()
    placesLibraryPromise = (async () => {
      if (lastAuthFailure) {
        throw lastAuthFailure
      }

      installGoogleMapsDynamicLoader({
        key: apiKey,
        v: 'weekly',
        language: 'es',
        authReferrerPolicy: 'origin',
      })

      if (typeof google.maps.importLibrary !== 'function') {
        const error = new Error('import_library_unavailable')
        logGoogleMapsFailure('loadPlacesLibrary', 'import_library_unavailable', error, {
          ...apiKeyMeta,
          extra: {
            hasGoogleObject: Boolean(window.google),
            hasMapsObject: Boolean(window.google?.maps),
            note: 'importLibrary missing after bootstrap',
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
    })().catch((error) => {
      logGoogleMapsFailure('loadPlacesLibrary', 'load_google_maps_places_library', error, apiKeyMeta)
      placesLibraryPromise = null
      throw error
    })
  }

  return placesLibraryPromise
}
