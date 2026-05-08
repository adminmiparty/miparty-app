import type { Metadata } from 'next'
import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { getTheme } from '@/lib/themes'
import EventRecap from './EventRecap'
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
  invitation_theme: string | null
  invitation_image_url: string | null
  invitation_image_fit: 'contain' | 'cover' | null
  invitation_image_position: string | null
  invitation_image_zoom: number | null
}

type FoodOption = {
  label: string
}

const DEFAULT_APP_METADATA: Metadata = {
  title: 'MiParty — Organiza el cumple perfecto',
  description: 'Crea tu invitación, comparte el enlace y gestiona las respuestas en un solo lugar.',
}

type MetadataEventDetails = {
  title: string
  event_date: string
  location_name: string | null
  invitation_image_url: string | null
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatSpanishFullDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  return capitalizeFirst(
    date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  )
}

function formatRsvpDeadlineLabel(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return capitalizeFirst(format(deadline, "EEEE, d 'de' MMMM", { locale: es }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('title, event_date, location_name, invitation_image_url')
    .eq('public_slug', slug)
    .maybeSingle<MetadataEventDetails>()

  if (!event) {
    return DEFAULT_APP_METADATA
  }

  const description = `Confirma tu asistencia a ${event.title} el ${event.event_date} en ${event.location_name ?? 'Ubicación por confirmar'}`
  const title = `${event.title} — MiParty`
  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://miparty.net/e/${slug}`,
      siteName: 'MiParty',
      type: 'website',
    },
  }

  if (event.invitation_image_url) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [{ url: event.invitation_image_url }],
    }
  }

  return metadata
}

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const previewRaw = resolvedSearchParams?.preview
  const isPreview =
    previewRaw === 'true' || (Array.isArray(previewRaw) && previewRaw[0] === 'true')
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, child_name, title, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, enable_food_options, organizer_notes, rsvp_deadline_days, organizer_phone, birthday_number, invitation_theme, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom'
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

  const rsvpDeadline =
    event.rsvp_deadline_days != null &&
    event.rsvp_deadline_days > 0 &&
    Number.isFinite(event.rsvp_deadline_days)
      ? formatRsvpDeadlineLabel(event.event_date, event.rsvp_deadline_days)
      : null
  const theme = getTheme(event.invitation_theme)

  return (
    <main className={`min-h-screen bg-gradient-to-b ${theme.pageBg} px-4 py-8`}>
      <div className="mx-auto w-full max-w-md space-y-4">
        {isPreview ? (
          <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800">
            👁️ Vista previa — así verán la invitación tus invitados
          </div>
        ) : null}
        <div
          id="invitation-recap"
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        >
          <EventRecap
            title={event.title}
            childName={event.child_name}
            birthdayNumber={event.birthday_number}
            eventDate={formatSpanishFullDate(event.event_date)}
            rsvpDeadline={rsvpDeadline}
            startTime={event.start_time}
            pickupTime={event.pickup_time}
            locationName={event.location_name ?? 'Ubicación'}
            locationAddress={event.location_address ?? ''}
            googleMapsUrl={event.google_maps_url}
            giftOption={event.gift_option}
            bizumPhone={event.bizum_phone}
            foodOptions={foodOptions}
            hasFoodOptions={Boolean(event.enable_food_options)}
            organizerNotes={event.organizer_notes}
            invitationImageUrl={event.invitation_image_url}
            invitationImageFit={event.invitation_image_fit}
            invitationImagePosition={event.invitation_image_position}
            invitationImageZoom={event.invitation_image_zoom}
            theme={theme}
          />
        </div>

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
          isPreview={isPreview}
          rsvpDeadline={rsvpDeadline}
          theme={theme}
          themeKey={event.invitation_theme}
        />
      </div>
    </main>
  )
}
