/** Minimal types for Google Maps JavaScript API + Places API (New). */
declare namespace google.maps {
  function importLibrary(name: 'places'): Promise<google.maps.PlacesLibrary>

  interface PlacesLibrary {
    AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken
    AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion
    Place: typeof google.maps.places.Place
  }

  namespace places {
    class AutocompleteSessionToken {
      constructor()
    }

    class AutocompleteSuggestion {
      static fetchAutocompleteSuggestions(request: {
        input: string
        sessionToken?: AutocompleteSessionToken
        includedRegionCodes?: string[]
        language?: string
      }): Promise<{ suggestions: AutocompleteSuggestionResult[] }>
    }

    interface AutocompleteSuggestionResult {
      placePrediction?: PlacePrediction
    }

    interface PlacePrediction {
      text?: { text?: string }
      toPlace(): Place
    }

    class Place {
      id?: string
      displayName?: string
      formattedAddress?: string
      googleMapsURI?: string
      fetchFields(options: { fields: string[] }): Promise<void>
    }
  }
}
