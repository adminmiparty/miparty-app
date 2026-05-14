import AppNav from '@/components/AppNav'
import type { Metadata } from 'next'
import Link from 'next/link'
import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/server'
import { getTheme, type ThemeKey } from '@/lib/themes'
import EventRecap from './EventRecap'
import RsvpForm, { InvitationPreviewTopBar } from './RsvpForm'

function pickPreviewNavTheme(urlTheme: string | null | undefined, invitationTheme: string | null): ThemeKey {
  const u = urlTheme?.trim()
  if (u === 'yellow' || u === 'pink' || u === 'blue' || u === 'green' || u === 'purple') {
    return u
  }
  const inv = invitationTheme?.trim()
  if (
    inv === 'yellow' ||
    inv === 'pink' ||
    inv === 'blue' ||
    inv === 'green' ||
    inv === 'purple'
  ) {
    return inv
  }
  return 'yellow'
}

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
  gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool'
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

function formatRsvpConfirmacionesLineFull(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return capitalizeFirst(format(deadline, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))
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
  searchParams: Promise<{ preview?: string | string[]; theme?: string | string[] }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const previewRaw = resolvedSearchParams?.preview
  const themeRaw = resolvedSearchParams?.theme
  const themeFromUrl =
    typeof themeRaw === 'string' ? themeRaw : Array.isArray(themeRaw) ? themeRaw[0] : null
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
      <>
        <AppNav backHref="/" backLabel="⬅️ Inicio" />
        <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-10">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <p className="text-center text-sm text-gray-700">Este evento no existe o ha sido eliminado.</p>
          </div>
        </main>
      </>
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
  const confirmacionesLine =
    event.rsvp_deadline_days != null &&
    event.rsvp_deadline_days > 0 &&
    Number.isFinite(event.rsvp_deadline_days)
      ? `Confirmaciones hasta el ${formatRsvpConfirmacionesLineFull(event.event_date, event.rsvp_deadline_days)}`
      : 'Confirmaciones hasta el día del evento'
  const theme = getTheme(event.invitation_theme)
  const previewNavTheme = pickPreviewNavTheme(themeFromUrl, event.invitation_theme)

  return (
    <main className={`min-h-screen bg-gradient-to-b ${theme.pageBg}`}>
      {isPreview ? (
        <InvitationPreviewTopBar publicSlug={slug} themeKey={previewNavTheme} />
      ) : (
        <AppNav backHref="/" backLabel="⬅️ Inicio" />
      )}
      <div className={`px-4 ${isPreview ? 'pb-8 pt-4' : 'py-8'}`}>
        <div className="mx-auto w-full max-w-md space-y-4">
        <div
          id="invitation-recap"
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        >
          <EventRecap
            title={event.title}
            childName={event.child_name}
            birthdayNumber={event.birthday_number}
            eventDate={formatSpanishFullDate(event.event_date)}
            confirmacionesLine={confirmacionesLine}
            startTime={event.start_time}
            pickupTime={event.pickup_time}
            locationName={event.location_name ?? 'Ubicación'}
            locationAddress={event.location_address ?? ''}
            googleMapsUrl={event.google_maps_url}
            giftOption={event.gift_option}
            bizumPhone={event.bizum_phone}
            foodOptions={foodOptions}
            hasFoodOptions={Boolean(event.enable_food_options)}
            organizerNotes={null}
            organizerPhone={event.organizer_phone}
            invitationThemeKey={event.invitation_theme}
            invitationImageUrl={event.invitation_image_url}
            invitationImageFit={event.invitation_image_fit}
            invitationImagePosition={event.invitation_image_position}
            invitationImageZoom={event.invitation_image_zoom}
            theme={theme}
            isPreview={isPreview}
          />
          {event.organizer_notes?.trim() ? (
            <div className="mt-3 space-y-4">
              <p className="text-sm font-medium not-italic text-gray-800">
                <span aria-hidden>📋</span> Mensaje para los invitados
              </p>
              <p className="whitespace-pre-wrap text-sm italic text-gray-500">{event.organizer_notes}</p>
            </div>
          ) : null}
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
      </div>
    </main>
  )
}
