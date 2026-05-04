import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditEventForm, { type EditEventFormInitialValues } from './EditEventForm'

function formatIsoToDisplayDate(isoDate: string | null) {
  if (!isoDate) {
    return ''
  }
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return ''
  }
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

function parseLocationAddress(combined: string | null): {
  street: string
  postal: string
  city: string
} {
  if (!combined?.trim()) {
    return { street: '', postal: '', city: '' }
  }
  const locationAddress = combined.trim()
  // location_address format: "street, postal city"
  // Example: "C. del Tomillar 12-30, 28042 Madrid"
  const parts = locationAddress.split(',')
  const street = parts[0]?.trim() ?? ''
  const postalCity = parts.slice(1).join(',').trim() // everything after first comma
  const postalCityParts = postalCity.split(' ').filter(Boolean)
  const postal = postalCityParts[0] ?? ''
  const city = postalCityParts.slice(1).join(' ') ?? ''
  return { street, postal, city }
}

function parseE164ForForm(full: string | null): { code: string; national: string } {
  const t = (full ?? '').trim()
  if (!t) {
    return { code: '+34', national: '' }
  }
  if (t.startsWith('+34')) {
    return { code: '+34', national: t.slice(3).trim() }
  }
  if (t.startsWith('+57')) {
    return { code: '+57', national: t.slice(3).trim() }
  }
  return { code: '+34', national: t.replace(/^\+\d{1,3}/, '').trim() }
}

function sliceTimeForInput(time: string | null): string {
  if (!time) {
    return ''
  }
  const parts = time.split(':')
  if (parts.length < 2) {
    return ''
  }
  const h = parts[0] ?? '00'
  const m = (parts[1] ?? '00').slice(0, 2)
  return `${h.padStart(2, '0')}:${m}`
}

type DbEventRow = {
  id: string
  user_id: string
  child_name: string
  child_birth_date: string | null
  title: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  gift_option: string | null
  bizum_phone: string | null
  rsvp_deadline_days: number | null
  birthday_number: number | null
  organizer_phone: string | null
  enable_food_options: boolean | null
  organizer_notes: string | null
}

function normalizeGiftOption(raw: string | null): EditEventFormInitialValues['gift_option'] {
  if (raw === 'bizum_pool') {
    return 'bizum_pool'
  }
  return 'regalo_libre'
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, user_id, child_name, child_birth_date, title, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, rsvp_deadline_days, birthday_number, organizer_phone, enable_food_options, organizer_notes'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle<DbEventRow>()

  if (eventError || !event) {
    notFound()
  }

  const { data: foodRows } = await supabase
    .from('event_food_options')
    .select('label')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  const foodLabels = (foodRows ?? []).map((row: { label: string }) => row.label)
  const foodEnabled = Boolean(event.enable_food_options)
  const loc = parseLocationAddress(event.location_address)
  const organizer = parseE164ForForm(event.organizer_phone)
  const bizum = parseE164ForForm(event.bizum_phone)

  const initialValues: EditEventFormInitialValues = {
    child_name: event.child_name,
    child_birth_date_display: formatIsoToDisplayDate(event.child_birth_date),
    event_title: event.title,
    event_date_display: formatIsoToDisplayDate(event.event_date),
    start_time: sliceTimeForInput(event.start_time) || '17:00',
    pickup_time: event.pickup_time ? sliceTimeForInput(event.pickup_time) : '',
    rsvp_deadline_days_display:
      event.rsvp_deadline_days != null && Number.isFinite(event.rsvp_deadline_days)
        ? String(event.rsvp_deadline_days)
        : '',
    location_name: event.location_name ?? '',
    location_street: loc.street,
    location_city: loc.city,
    location_postal: loc.postal,
    google_maps_url: event.google_maps_url ?? '',
    gift_option: normalizeGiftOption(event.gift_option),
    bizum_country_code: bizum.code,
    bizum_phone_national: bizum.national,
    organizer_country_code: organizer.code,
    organizer_phone_national: organizer.national,
    food_enabled: foodEnabled,
    food_option_labels: foodLabels.length > 0 ? foodLabels : [''],
    organizer_notes: event.organizer_notes ?? '',
    birthday_number_display:
      event.birthday_number != null && Number.isFinite(event.birthday_number)
        ? String(event.birthday_number)
        : '',
    event_had_organizer_phone: organizer.national.trim() !== '',
  }

  return <EditEventForm eventId={event.id} initialValues={initialValues} />
}
