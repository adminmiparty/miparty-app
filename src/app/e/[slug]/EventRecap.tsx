import { type getTheme } from '@/lib/themes'

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
  invitationImageUrl?: string | null
  invitationImageFit?: string | null
  invitationImagePosition?: string | null
  invitationImageZoom?: number | null
  theme: ReturnType<typeof getTheme>
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
  invitationImageUrl,
  invitationImageFit,
  invitationImagePosition,
  invitationImageZoom,
  theme: _theme,
}: EventRecapProps) {
  const headline =
    birthdayNumber != null && birthdayNumber > 0 && Number.isFinite(birthdayNumber)
      ? `¡${childName} cumple ${birthdayNumber} años y estás invitado/a! 🎉`
      : `¡Estás invitado/a al ${title}! 🎉`
  const fitClass = invitationImageFit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'

  return (
    <>
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

        {organizerNotes ? (
          <p className="text-sm text-gray-500 italic">{`📓 ${organizerNotes}`}</p>
        ) : null}
      </div>
    </>
  )
}
