let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null

function getApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('browser_only'))
  }

  if (typeof window.google?.maps?.importLibrary === 'function') {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-miparty-google-maps="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('script_load_failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.dataset.mipartyGoogleMaps = '1'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('script_load_failed'))
    document.head.appendChild(script)
  })
}

export function hasGoogleMapsApiKey() {
  return getApiKey().length > 0
}

export async function loadGoogleMapsPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('missing_api_key')
  }

  if (!placesLibraryPromise) {
    placesLibraryPromise = loadMapsScript(apiKey)
      .then(async () => {
        if (typeof window.google?.maps?.importLibrary !== 'function') {
          throw new Error('import_library_unavailable')
        }
        return google.maps.importLibrary('places')
      })
      .catch((error) => {
        placesLibraryPromise = null
        throw error
      })
  }

  return placesLibraryPromise
}
