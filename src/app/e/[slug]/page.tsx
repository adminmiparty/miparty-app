import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import RsvpForm from './RsvpForm'

type EventDetails = {
  id: string
  child_name: string
  title: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  gift_option: 'regalo_libre' | 'bizum_pool'
  bizum_phone: string | null
  enable_food_options: boolean | null
  organizer_notes: string | null
  rsvp_deadline_days: number | null
  organizer_phone: string | null
  birthday_number: number | null
}

type FoodOption = {
  label: string
}

function formatSpanishFullDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeValue(time: string) {
  return time.slice(0, 5)
}

function formatFoodOptions(options: string[]) {
  if (options.length === 0) {
    return ''
  }
  if (options.length === 1) {
    return options[0]
  }
  if (options.length === 2) {
    return `${options[0]} o ${options[1]}`
  }
  const head = options.slice(0, -1).join(', ')
  const last = options[options.length - 1]
  return `${head} o ${last}`
}

function getGiftLine(event: EventDetails) {
  if (event.gift_option === 'regalo_libre') {
    return '🎁 Regalo libre'
  }

  if (event.bizum_phone?.startsWith('+34')) {
    return `🎁 Hucha al móvil ${event.bizum_phone.replace(/^\+\d{2}/, '')} (Bizum)`
  }

  if (event.bizum_phone?.startsWith('+57')) {
    return `🎁 Nequi al ${event.bizum_phone.replace(/^\+\d{2}/, '')}`
  }

  return '🎁 Regalo compartido'
}

function formatRsvpDeadlineMessage(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return `Puedes confirmar hasta el ${format(deadline, "EEEE, d 'de' MMMM", { locale: es })}`
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, child_name, title, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, enable_food_options, organizer_notes, rsvp_deadline_days, organizer_phone, birthday_number'
    )
    .eq('public_slug', slug)
    .maybeSingle<EventDetails>()

  if (!event) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <p className="text-center text-sm text-gray-700">Este evento no existe o ha sido eliminado.</p>
        </div>
      </main>
    )
  }

  let foodOptions: FoodOption[] = []
  if (event.enable_food_options) {
    const { data } = await supabase
      .from('event_food_options')
      .select('label')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true })
    foodOptions = (data ?? []) as FoodOption[]
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <p className="text-2xl font-bold text-gray-900">{`¡Estás invitado/a al ${event.title}! 🎉`}</p>
          {event.birthday_number != null && event.birthday_number > 0 ? (
            <p className="mt-1 text-sm text-gray-500">{`${event.birthday_number}º cumpleaños de ${event.child_name}`}</p>
          ) : null}
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="text-gray-700">{`📅 ${formatSpanishFullDate(event.event_date)}`}</p>
            {event.rsvp_deadline_days != null &&
            event.rsvp_deadline_days > 0 &&
            Number.isFinite(event.rsvp_deadline_days) ? (
              <p className="text-sm text-gray-500">
                {formatRsvpDeadlineMessage(event.event_date, event.rsvp_deadline_days)}
              </p>
            ) : null}
            <p className="text-gray-700">
              {event.pickup_time
                ? `🕒 ${formatTimeValue(event.start_time)} a ${formatTimeValue(event.pickup_time)}`
                : `🕒 ${formatTimeValue(event.start_time)}`}
            </p>

            {event.google_maps_url ? (
              <>
                <a
                  href={event.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block no-underline"
                >
                  <p className="text-gray-700">{`📍 ${event.location_name ?? 'Ubicación'}`}</p>
                  <p className="text-sm text-gray-500">{event.location_address ?? ''}</p>
                </a>
                <a
                  href={event.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-gray-400 no-underline"
                >
                  Ver en Google Maps ↗
                </a>
              </>
            ) : (
              <div>
                <p className="text-gray-700">{`📍 ${event.location_name ?? 'Ubicación'}`}</p>
                <p className="text-sm text-gray-500">{event.location_address ?? ''}</p>
              </div>
            )}

            <p className="text-gray-700">{getGiftLine(event)}</p>

            {event.enable_food_options && foodOptions.length > 0 ? (
              <p className="text-gray-700">{`🍽️ ${formatFoodOptions(foodOptions.map((option) => option.label))}`}</p>
            ) : null}

            {event.organizer_notes ? <p className="text-sm text-gray-500 italic">{`📓 ${event.organizer_notes}`}</p> : null}
          </div>
        </section>

        <RsvpForm
          eventId={event.id}
          foodOptions={foodOptions}
          hasFoodOptions={Boolean(event.enable_food_options)}
          eventTitle={event.title}
          eventDate={event.event_date}
          startTime={event.start_time}
          pickupTime={event.pickup_time}
          locationName={event.location_name}
          locationAddress={event.location_address}
          googleMapsUrl={event.google_maps_url}
          organizerNotes={event.organizer_notes}
          organizerPhone={event.organizer_phone}
          childName={event.child_name}
        />
      </div>
    </main>
  )
}
