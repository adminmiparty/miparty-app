/**
 * Structured Google Maps / Places load diagnostics for production debugging.
 * Never logs API keys.
 */

export type GoogleMapsFailureKind =
  | 'missing_api_key'
  | 'browser_only'
  | 'script_load_failed'
  | 'import_library_unavailable'
  | 'import_library_places'
  | 'gm_authFailure'
  | 'ApiNotActivatedMapError'
  | 'RefererNotAllowedMapError'
  | 'InvalidKeyMapError'
  | 'MissingKeyMapError'
  | 'RequestDeniedMapError'
  | 'OverQuotaMapError'
  | 'DeletedApiProjectMapError'
  | 'ClientIdLooksLikeKeyError'
  | 'InvalidClientIdMapError'
  | 'unknown'

export type GoogleMapsLogContext = 'loadPlacesLibrary' | 'PlacesAutocompleteSearch'

const GOOGLE_MAP_ERROR_NAMES = [
  'ApiNotActivatedMapError',
  'RefererNotAllowedMapError',
  'InvalidKeyMapError',
  'MissingKeyMapError',
  'RequestDeniedMapError',
  'OverQuotaMapError',
  'DeletedApiProjectMapError',
  'ClientIdLooksLikeKeyError',
  'InvalidClientIdMapError',
] as const

const STAGE_TO_KIND: Record<string, GoogleMapsFailureKind> = {
  missing_api_key: 'missing_api_key',
  browser_only: 'browser_only',
  script_load_failed: 'script_load_failed',
  script_existing_wait_failed: 'script_load_failed',
  import_library_unavailable: 'import_library_unavailable',
  import_library_places: 'import_library_places',
  gm_authFailure: 'gm_authFailure',
}

function extractErrorText(error: unknown): string {
  if (error == null) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return [error.name, error.message, error.stack ?? ''].join('\n')
  }
  if (typeof error === 'object') {
    try {
      const record = error as Record<string, unknown>
      const parts = [
        record.name,
        record.message,
        record.type,
        record.status,
        record.code,
      ]
        .filter((value) => value != null)
        .map(String)
      if (parts.length > 0) {
        return parts.join(' ')
      }
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

/** Maps thrown messages / Google console errors to a stable failure kind. */
export function classifyGoogleMapsFailure(
  error: unknown,
  stage: string
): GoogleMapsFailureKind {
  if (stage in STAGE_TO_KIND) {
    return STAGE_TO_KIND[stage]
  }

  const text = extractErrorText(error)
  for (const name of GOOGLE_MAP_ERROR_NAMES) {
    if (text.includes(name)) {
      return name
    }
  }

  if (/referer.*not.*allowed/i.test(text)) {
    return 'RefererNotAllowedMapError'
  }
  if (/api.*not.*activated|apinotactivated/i.test(text)) {
    return 'ApiNotActivatedMapError'
  }
  if (/invalid.*key/i.test(text)) {
    return 'InvalidKeyMapError'
  }
  if (/missing.*key/i.test(text)) {
    return 'MissingKeyMapError'
  }

  return 'unknown'
}

function serializeError(error: unknown): Record<string, unknown> | string | null {
  if (error == null) {
    return null
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? error.cause.message : error.cause,
    }
  }
  if (typeof error === 'object') {
    try {
      return { ...(error as Record<string, unknown>) }
    } catch {
      return String(error)
    }
  }
  return String(error)
}

export type GoogleMapsFailureLog = {
  context: GoogleMapsLogContext
  stage: string
  failureKind: GoogleMapsFailureKind
  message: string
  errorName: string | null
  error: ReturnType<typeof serializeError>
  manualFallback: boolean
  pageUrl: string | null
  apiKeyConfigured: boolean
  apiKeyLength: number
  userAgent: string | null
  extra?: Record<string, unknown>
}

export function buildGoogleMapsFailureLog(
  context: GoogleMapsLogContext,
  stage: string,
  error: unknown,
  options?: {
    manualFallback?: boolean
    apiKeyConfigured?: boolean
    apiKeyLength?: number
    extra?: Record<string, unknown>
  }
): GoogleMapsFailureLog {
  const failureKind = classifyGoogleMapsFailure(error, stage)
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : extractErrorText(error) || stage

  return {
    context,
    stage,
    failureKind,
    message,
    errorName: error instanceof Error ? error.name : null,
    error: serializeError(error),
    manualFallback: options?.manualFallback ?? false,
    pageUrl: typeof window !== 'undefined' ? window.location.href : null,
    apiKeyConfigured: options?.apiKeyConfigured ?? false,
    apiKeyLength: options?.apiKeyLength ?? 0,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    ...(options?.extra ? { extra: options.extra } : {}),
  }
}

/** Short Spanish copy for in-app banners (no secrets). */
export function googleMapsFailureUserMessage(kind: GoogleMapsFailureKind): string {
  switch (kind) {
    case 'missing_api_key':
      return 'Google Maps no está configurado en este entorno. Puedes introducir la dirección manualmente.'
    case 'RefererNotAllowedMapError':
    case 'gm_authFailure':
      return 'Google Maps rechazó esta web (restricción de dominio en la clave API). Añade https://miparty.net/* y https://www.miparty.net/* en Google Cloud Console, o usa la entrada manual.'
    case 'ApiNotActivatedMapError':
      return 'Falta activar Maps JavaScript API o Places API (New) en Google Cloud. Mientras tanto, usa la entrada manual.'
    case 'script_load_failed':
      return 'No se pudo cargar Google Maps (red, bloqueador o VPN). Prueba de nuevo o introduce la dirección manualmente.'
    case 'import_library_unavailable':
    case 'import_library_places':
      return 'No pudimos iniciar la búsqueda de Google Maps. Prueba de nuevo o introduce la dirección manualmente.'
    case 'InvalidKeyMapError':
    case 'MissingKeyMapError':
    case 'DeletedApiProjectMapError':
      return 'La clave de Google Maps no es válida. Revisa la configuración del proyecto o usa la entrada manual.'
    case 'OverQuotaMapError':
      return 'Google Maps ha alcanzado el límite de uso. Usa la entrada manual por ahora.'
    default:
      return 'No pudimos cargar la búsqueda de Google Maps. Prueba de nuevo o introduce la dirección manualmente.'
  }
}

/** Always logs in production (console.error). */
export function logGoogleMapsFailure(
  context: GoogleMapsLogContext,
  stage: string,
  error: unknown,
  options?: Parameters<typeof buildGoogleMapsFailureLog>[3]
): GoogleMapsFailureLog {
  const payload = buildGoogleMapsFailureLog(context, stage, error, options)
  console.error(`[GoogleMaps][${context}][${payload.failureKind}]`, payload)
  return payload
}

type WindowWithGmAuth = Window & {
  gm_authFailure?: () => void
  __mipartyGmAuthFailureHooked?: boolean
}

/** Google calls this when the API key or HTTP referrer restriction is invalid. */
export function ensureGoogleMapsAuthFailureLogger(
  onAuthFailure: (error: Error) => void
): void {
  if (typeof window === 'undefined') {
    return
  }

  const w = window as WindowWithGmAuth
  if (w.__mipartyGmAuthFailureHooked) {
    return
  }
  w.__mipartyGmAuthFailureHooked = true

  const previous = w.gm_authFailure
  w.gm_authFailure = () => {
    const error = new Error(
      'gm_authFailure: Google Maps rejected this API key or HTTP referrer (often RefererNotAllowedMapError or InvalidKeyMapError).'
    )
    error.name = 'gm_authFailure'
    onAuthFailure(error)
    previous?.()
  }
}
