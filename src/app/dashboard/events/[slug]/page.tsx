import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShareButton from '@/components/ShareButton'

type EventDetails = {
  id: string
  user_id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  enable_food_options: boolean | null
  invitation_theme: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | null
  invitation_image_url: string | null
  invitation_image_fit: 'contain' | 'cover' | null
  invitation_image_position: string | null
  invitation_image_zoom: number | null
}

type RsvpItem = {
  id: string
  child_name: string
  child_last_name: string | null
  guest_parent_name: string
  attendance_status: 'confirmed' | 'declined' | 'maybe' | null
  food_preference: string | null
  allergy_notes: string | null
  extra_notes: string | null
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

export default async function EventControlCenterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, user_id, public_slug, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, enable_food_options, invitation_theme, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom'
    )
    .eq('public_slug', slug)
    .eq('user_id', user.id)
    .maybeSingle<EventDetails>()

  if (eventError || !event) {
    notFound()
  }

  const { data: rsvpRows } = await supabase
    .from('rsvps')
    .select('id, child_name, child_last_name, guest_parent_name, attendance_status, food_preference, allergy_notes, extra_notes')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  const rsvps = (rsvpRows ?? []) as RsvpItem[]
  const confirmedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'confirmed').length
  const declinedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'declined').length
  const maybeCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'maybe').length
  const pendingCount = 0

  const foodPreferenceCounts = (() => {
    const counts = new Map<string, number>()
    rsvps.forEach((rsvp) => {
      const label = rsvp.food_preference?.trim()
      if (!label) {
        return
      }
      counts.set(label, (counts.get(label) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  })()

  const allergyEntries = rsvps
    .filter((rsvp) => (rsvp.allergy_notes ?? '').trim() !== '')
    .map((rsvp) => ({
      childName: `${rsvp.child_name}${rsvp.child_last_name ? ` ${rsvp.child_last_name}` : ''}`.trim(),
      note: (rsvp.allergy_notes ?? '').trim(),
    }))

  const messageEntries = rsvps
    .filter((rsvp) => (rsvp.extra_notes ?? '').trim() !== '')
    .map((rsvp) => ({
      childName: `${rsvp.child_name}${rsvp.child_last_name ? ` ${rsvp.child_last_name}` : ''}`.trim(),
      parentName: rsvp.guest_parent_name,
      note: (rsvp.extra_notes ?? '').trim(),
    }))

  const themeKey = event.invitation_theme ?? 'yellow'
  const pageBgMap: Record<string, string> = {
    yellow: 'from-yellow-50 to-white',
    pink: 'from-pink-50 to-white',
    blue: 'from-blue-50 to-white',
    green: 'from-green-50 to-white',
    purple: 'from-purple-50 to-white',
  }
  const buttonMap: Record<string, string> = {
    yellow: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
    pink: 'bg-pink-400 hover:bg-pink-500 text-white',
    blue: 'bg-blue-400 hover:bg-blue-500 text-white',
    green: 'bg-green-400 hover:bg-green-500 text-gray-900',
    purple: 'bg-purple-400 hover:bg-purple-500 text-white',
  }
  const accentBorderMap: Record<string, string> = {
    yellow: 'border-yellow-200',
    pink: 'border-pink-200',
    blue: 'border-blue-200',
    green: 'border-green-200',
    purple: 'border-purple-200',
  }
  const accentSoftBgMap: Record<string, string> = {
    yellow: 'bg-yellow-50',
    pink: 'bg-pink-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
  }
  const accentTextMap: Record<string, string> = {
    yellow: 'text-yellow-600',
    pink: 'text-pink-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  }
  const pageBg = pageBgMap[themeKey] ?? pageBgMap.yellow
  const primaryButtonClass = buttonMap[themeKey] ?? buttonMap.yellow
  const accentBorderClass = accentBorderMap[themeKey] ?? accentBorderMap.yellow
  const accentSoftBgClass = accentSoftBgMap[themeKey] ?? accentSoftBgMap.yellow
  const accentTextClass = accentTextMap[themeKey] ?? accentTextMap.yellow

  return (
    <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
      <div className="mx-auto w-full max-w-md md:max-w-6xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_minmax(0,1fr)] md:gap-6">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl md:sticky md:top-6 md:self-start">
              <h1 className="text-2xl font-bold text-gray-900">Resumen del evento</h1>
              <p className="mt-1 text-sm text-gray-600">{event.title}</p>
              <p className="mt-2 text-sm text-gray-700">{`📅 ${formatSpanishFullDate(event.event_date)}`}</p>
              <p className="text-sm text-gray-700">
                {event.pickup_time
                  ? `🕒 ${formatTimeValue(event.start_time)} a ${formatTimeValue(event.pickup_time)}`
                  : `🕒 A las ${formatTimeValue(event.start_time)}`}
              </p>

              {event.invitation_image_url ? (
                <div className={`mt-3 overflow-hidden rounded-2xl border ${accentBorderClass}`}>
                  <img
                    src={event.invitation_image_url}
                    alt="Invitación"
                    style={{
                      objectPosition:
                        event.invitation_image_fit === 'cover' ? (event.invitation_image_position ?? '50% 50%') : undefined,
                      transform:
                        event.invitation_image_fit === 'cover' && event.invitation_image_zoom
                          ? `scale(${event.invitation_image_zoom})`
                          : undefined,
                      transformOrigin:
                        event.invitation_image_fit === 'cover' ? (event.invitation_image_position ?? '50% 50%') : undefined,
                    }}
                    className={`w-full max-h-72 ${
                      event.invitation_image_fit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'
                    }`}
                  />
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-2">
                <ShareButton
                  eventTitle={event.title}
                  childName={event.child_name}
                  slug={event.public_slug}
                  className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${primaryButtonClass}`}
                />
                <Link
                  href={`/e/${event.public_slug}?preview=true`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  Ver invitación
                </Link>
                <Link
                  href={`/dashboard/events/${event.public_slug}/edit`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Editar evento
                </Link>
              </div>
            </section>

          </aside>

          <section className="space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-gray-600">✅ Asisten</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{confirmedCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-gray-600">❌ No vienen</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{declinedCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-gray-600">🤔 Aún no lo saben</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{maybeCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-gray-600">⏳ Sin respuesta</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{pendingCount}</p>
                </div>
              </div>
              {rsvps.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center">
                  <p className="text-sm text-gray-600">
                    Aún no hay respuestas. Comparte tu invitación para empezar a recibir confirmaciones 🎉
                  </p>
                  <ShareButton
                    eventTitle={event.title}
                    childName={event.child_name}
                    slug={event.public_slug}
                    className={`mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${primaryButtonClass}`}
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {rsvps.map((rsvp) => {
                    const status =
                      rsvp.attendance_status === 'confirmed'
                        ? { label: 'Sí asiste', badge: 'bg-green-100 text-green-700 border-green-200' }
                        : rsvp.attendance_status === 'declined'
                          ? { label: 'No asiste', badge: 'bg-red-100 text-red-700 border-red-200' }
                          : rsvp.attendance_status === 'maybe'
                            ? { label: 'Aún no lo sabe', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
                            : { label: 'Sin respuesta', badge: 'bg-gray-100 text-gray-600 border-gray-200' }
                    const fullChildName = `${rsvp.child_name}${rsvp.child_last_name ? ` ${rsvp.child_last_name}` : ''}`.trim()
                    return (
                      <article key={rsvp.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{fullChildName}</p>
                            <p className="text-xs text-gray-500">Adulto: {rsvp.guest_parent_name}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${status.badge}`}>{status.label}</span>
                        </div>
                        {rsvp.food_preference ? <p className="mt-2 text-sm text-gray-700">{`🍽️ ${rsvp.food_preference}`}</p> : null}
                        {rsvp.allergy_notes ? <p className="mt-1 text-sm text-gray-700">{`⚠️ ${rsvp.allergy_notes}`}</p> : null}
                        {rsvp.extra_notes ? (
                          <p className="mt-1 rounded-lg bg-gray-50 px-2 py-1 text-sm italic text-gray-600">{`💬 ${rsvp.extra_notes}`}</p>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {event.enable_food_options && foodPreferenceCounts.length > 0 ? (
              <section className={`rounded-2xl border p-4 shadow-xl ${accentBorderClass} ${accentSoftBgClass}`}>
                <h2 className="text-base font-semibold text-gray-900">🍽️ Resumen de comida</h2>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  {foodPreferenceCounts.map((item) => (
                    <p key={item.label}>{`${item.label} → ${item.count}`}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {allergyEntries.length > 0 ? (
              <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl">
                <h2 className="text-base font-semibold text-amber-900">⚠️ Alergias e intolerancias</h2>
                <div className="mt-2 space-y-1 text-sm text-amber-900">
                  {allergyEntries.map((entry, index) => (
                    <p key={`${entry.childName}-${index}`}>{`${entry.childName}: ${entry.note}`}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {messageEntries.length > 0 ? (
              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
                <h2 className="text-base font-semibold text-gray-900">Mensajes de familias</h2>
                <div className="mt-2 space-y-2">
                  {messageEntries.map((entry, index) => (
                    <div key={`${entry.parentName}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-500">{`${entry.parentName} · ${entry.childName}`}</p>
                      <p className="mt-1 text-sm text-gray-700">{entry.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}
