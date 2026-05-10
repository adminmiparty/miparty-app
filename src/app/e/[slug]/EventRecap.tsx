import { type getTheme, type ThemeKey } from '@/lib/themes'

export type EventRecapProps = {
  title: string
  childName: string
  birthdayNumber: number | null
  eventDate: string
  rsvpDeadline: string | null
  startTime: string
  pickupTime: string | null
  locationName: string
  locationAddress: string
  googleMapsUrl: string | null
  giftOption: string | null
  bizumPhone: string | null
  foodOptions: { label: string }[]
  hasFoodOptions: boolean
  organizerNotes: string | null
  organizerPhone?: string | null
  invitationThemeKey?: string | null
  invitationImageUrl?: string | null
  invitationImageFit?: string | null
  invitationImagePosition?: string | null
  invitationImageZoom?: number | null
  theme: ReturnType<typeof getTheme>
  isPreview?: boolean
}

function formatTimeValue(time: string) {
  return time.slice(0, 5)
}

function getGiftLine(giftOption: string | null, bizumPhone: string | null) {
  if (giftOption == null) {
    return null
  }

  if (giftOption === 'regalo_libre') {
    return '🎁 Regalo libre'
  }

  if (bizumPhone?.startsWith('+34')) {
    return `🎁 Hucha al móvil ${bizumPhone.replace(/^\+\d{2}/, '')} (Bizum)`
  }

  if (bizumPhone?.startsWith('+57')) {
    return `🎁 Nequi al ${bizumPhone.replace(/^\+\d{2}/, '')}`
  }

  return '🎁 Regalo compartido'
}

function digitsForWhatsApp(phone: string) {
  return phone.replace(/\D/g, '')
}

function organizerTelLinkClass(themeKey: string | null | undefined) {
  const k: ThemeKey =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const map: Record<ThemeKey, string> = {
    yellow: 'text-yellow-700 underline decoration-yellow-600/40 underline-offset-2 hover:text-yellow-900',
    pink: 'text-pink-600 underline decoration-pink-400/40 underline-offset-2 hover:text-pink-800',
    blue: 'text-blue-600 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-800',
    green: 'text-green-700 underline decoration-green-600/40 underline-offset-2 hover:text-green-900',
    purple: 'text-purple-600 underline decoration-purple-400/40 underline-offset-2 hover:text-purple-800',
  }
  return map[k]
}

export default function EventRecap({
  title,
  childName,
  birthdayNumber,
  eventDate,
  rsvpDeadline,
  startTime,
  pickupTime,
  locationName,
  locationAddress,
  googleMapsUrl,
  giftOption,
  bizumPhone,
  foodOptions,
  hasFoodOptions,
  organizerNotes,
  organizerPhone = null,
  invitationThemeKey = null,
  invitationImageUrl,
  invitationImageFit,
  invitationImagePosition,
  invitationImageZoom,
  theme: _theme,
  isPreview = false,
}: EventRecapProps) {
  const headline =
    birthdayNumber != null && birthdayNumber > 0 && Number.isFinite(birthdayNumber)
      ? `¡${childName} cumple ${birthdayNumber} años y estás invitado/a! 🎉`
      : `¡Estás invitado/a al ${title}! 🎉`
  const fitClass = invitationImageFit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'
  const organizerPhoneTrimmed = organizerPhone != null ? String(organizerPhone).trim() : ''
  const organizerWhatsAppDigits =
    organizerPhoneTrimmed !== '' ? digitsForWhatsApp(organizerPhoneTrimmed) : ''

  return (
    <>
      {isPreview ? (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800">
          👁️ Vista previa — así verán la invitación tus invitados
        </div>
      ) : null}
      {invitationImageUrl ? (
        <div className="w-full overflow-hidden rounded-2xl max-h-72 mb-4">
          <img
            src={invitationImageUrl}
            alt="Invitación"
            style={{
              objectPosition: invitationImageFit === 'cover' ? (invitationImagePosition ?? '50% 50%') : undefined,
              transform: invitationImageFit === 'cover' && invitationImageZoom ? `scale(${invitationImageZoom})` : undefined,
              transformOrigin: invitationImageFit === 'cover' ? (invitationImagePosition ?? '50% 50%') : undefined,
            }}
            className={`w-full max-h-72 ${fitClass}`}
          />
        </div>
      ) : null}
      <p className="text-center text-2xl font-bold text-gray-900">{headline}</p>
      <div className="mt-3 space-y-1.5 text-sm">
        <p className="text-gray-700">{`📅 ${eventDate}`}</p>
        {rsvpDeadline ? (
          <p className="text-sm text-gray-500">{`Puedes confirmar hasta el ${rsvpDeadline}`}</p>
        ) : null}
        <p className="text-gray-700">
          {pickupTime
            ? `🕒 ${formatTimeValue(startTime)} a ${formatTimeValue(pickupTime)}`
            : `🕒 ${formatTimeValue(startTime)}`}
        </p>

        <div>
          <p className="text-gray-700">{`📍 ${locationName}`}</p>
          {locationAddress ? <p className="pl-6 text-gray-700">{locationAddress}</p> : null}
          {googleMapsUrl ? (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block pl-6 text-xs text-gray-400 no-underline"
            >
              Ver en Google Maps ↗
            </a>
          ) : null}
        </div>

        {getGiftLine(giftOption, bizumPhone) ? <p className="text-gray-700">{getGiftLine(giftOption, bizumPhone)}</p> : null}

        {hasFoodOptions && foodOptions.length > 0 ? (
          <p className="text-gray-700">{`🍽️ ${foodOptions.map((option) => option.label).join(' · ')}`}</p>
        ) : null}

        {organizerPhoneTrimmed !== '' ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-gray-700">
              <span aria-hidden>📞</span> Contacto
            </span>
            <a
              href={`tel:${organizerPhoneTrimmed}`}
              className={`text-sm font-medium ${organizerTelLinkClass(invitationThemeKey)}`}
            >
              {organizerPhoneTrimmed}
            </a>
            {organizerWhatsAppDigits.length >= 8 ? (
              <a
                href={`https://wa.me/${organizerWhatsAppDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 text-green-500 transition hover:text-[#25D366]"
                aria-label="WhatsApp"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            ) : null}
          </div>
        ) : null}

        {organizerNotes ? (
          <p className="text-sm text-gray-500 italic">{`📋 ${organizerNotes}`}</p>
        ) : null}
      </div>
    </>
  )
}
