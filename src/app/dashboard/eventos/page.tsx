'use client'

// Eventos page — lists all events organized by the user
// Route: /dashboard/eventos
// Do not confuse with the event control center
// at /dashboard/eventos/[slug]

import { brand } from '@/lib/brand'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const themeCardBorder: Record<string, string> = {
  yellow: 'border-l-yellow-400',
  pink: 'border-l-pink-400',
  blue: 'border-l-blue-400',
  green: 'border-l-green-400',
  purple: 'border-l-purple-400',
}

const themeRingMap: Record<string, string> = {
  yellow: 'hover:ring-yellow-200',
  pink: 'hover:ring-pink-200',
  blue: 'hover:ring-blue-200',
  green: 'hover:ring-green-200',
  purple: 'hover:ring-purple-200',
}

type EventListItem = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  invitation_theme: string | null
}

function todayLocalIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatSpanishDateLong(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  const raw = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function EventRow({
  event,
  confirmedCount,
  todayStr,
}: {
  event: EventListItem
  confirmedCount: number
  todayStr: string
}) {
  const isPast = event.event_date < todayStr
  const themeKey = event.invitation_theme ?? 'yellow'
  const leftBorderClass =
    themeCardBorder[themeKey] ?? themeCardBorder.yellow
  const hoverRingClass = themeRingMap[themeKey] ?? themeRingMap.yellow
  return (
    <li className="w-full">
      <Link
        href={`/dashboard/eventos/${event.public_slug}`}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 border-l-4 ${leftBorderClass} bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:border-l-4 hover:shadow-md hover:ring-2 ${hoverRingClass}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900">{event.title}</p>
          <p className="mt-0.5 text-sm text-gray-700">{event.child_name}</p>
          <p className="mt-1 text-sm text-gray-600">{formatSpanishDateLong(event.event_date)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                isPast ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'
              }`}
            >
              {isPast ? 'Pasado' : 'Próximo'}
            </span>
            <span className="text-xs text-gray-500">
              {confirmedCount === 1 ? '1 confirmado' : `${confirmedCount} confirmados`}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-lg font-medium text-gray-400" aria-hidden>
          →
        </span>
      </Link>
    </li>
  )
}

export default function EventosPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [confirmedByEventId, setConfirmedByEventId] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [detailsUpOpen, setDetailsUpOpen] = useState(true)
  const [detailsPastOpen, setDetailsPastOpen] = useState(false)

  const todayStr = useMemo(() => todayLocalIso(), [])

  const { upcoming, past, total } = useMemo(() => {
    const up: EventListItem[] = []
    const pa: EventListItem[] = []
    for (const e of events) {
      if (e.event_date >= todayStr) up.push(e)
      else pa.push(e)
    }
    up.sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0))
    pa.sort((a, b) => (a.event_date > b.event_date ? -1 : a.event_date < b.event_date ? 1 : 0))
    return { upcoming: up, past: pa, total: events.length }
  }, [events, todayStr])

  useEffect(() => {
    if (!loading && !error) {
      setDetailsPastOpen(past.length > 0)
    }
  }, [loading, error, past.length])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (isMounted) {
          setError(userError?.message ?? 'No se pudo obtener tu sesión.')
          setLoading(false)
        }
        return
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select('id, public_slug, title, child_name, event_date, invitation_theme')
        .eq('user_id', user.id)

      if (!isMounted) return

      if (eventsError) {
        setError(eventsError.message)
        setEvents([])
        setConfirmedByEventId({})
        setLoading(false)
        return
      }

      const list = (data ?? []) as EventListItem[]
      setEvents(list)

      const counts: Record<string, number> = {}
      if (list.length > 0) {
        const ids = list.map((e) => e.id)
        const { data: rsvpRows, error: rsvpError } = await supabase
          .from('rsvps')
          .select('event_id')
          .eq('attendance_status', 'confirmed')
          .in('event_id', ids)

        if (!isMounted) return

        if (!rsvpError && rsvpRows) {
          for (const row of rsvpRows as { event_id: string }[]) {
            const id = row.event_id
            counts[id] = (counts[id] ?? 0) + 1
          }
        }
      }

      if (isMounted) {
        setConfirmedByEventId(counts)
        setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const renderList = (list: EventListItem[]) => (
    <ul className="grid w-full grid-cols-1 gap-3">
      {list.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          confirmedCount={confirmedByEventId[event.id] ?? 0}
          todayStr={todayStr}
        />
      ))}
    </ul>
  )

  const upcomingEmptyBlock = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">No tienes fiestas próximas.</p>
      <Link
        href="/dashboard/eventos/nuevo"
        className={`mt-4 inline-flex items-center justify-center rounded-lg ${brand.buttonPrimary} px-4 py-2.5 text-sm font-semibold shadow-sm transition`}
      >
        + Crear nueva fiesta
      </Link>
    </div>
  )

  const pastEmptyBlock = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">Aún no tienes fiestas pasadas.</p>
    </div>
  )

  const sectionHeaderClass =
    'flex w-full cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-left font-semibold text-gray-900 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden'

  return (
    <main className={`min-h-screen ${brand.pageBg} pb-12`}>
      <div className="sticky top-0 z-50 w-full border-b border-gray-200 bg-yellow-50/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            ⬅️ Inicio
          </Link>
          <Link href="/dashboard" className={`text-sm font-bold no-underline ${brand.textBrand}`}>
            MiParty
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Eventos</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">Tus fiestas organizadas</p>
          </div>
          <Link
            href="/dashboard/eventos/nuevo"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg ${brand.buttonPrimary} px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition sm:self-start`}
          >
            + Crear nueva fiesta
          </Link>
        </header>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:p-6">
          {loading ? <p className="text-sm text-gray-500">Cargando eventos...</p> : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!loading && !error && total === 0 ? (
            <div className="space-y-4">
              {upcomingEmptyBlock}
              {pastEmptyBlock}
            </div>
          ) : null}

          {!loading && !error && total > 0 && total <= 5 ? (
            <div className="space-y-6 px-4 sm:px-6">
              <h2 className="mb-4 mt-2 text-lg font-semibold text-gray-800">Mis eventos</h2>
              <details
                className="group rounded-xl border border-gray-100 bg-gray-50/50"
                open={detailsUpOpen}
                onToggle={(e) => setDetailsUpOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className={sectionHeaderClass}>
                  <span className="flex items-center gap-2">
                    Próximos
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      {upcoming.length}
                    </span>
                  </span>
                  <span
                    className={`text-gray-400 transition-transform ${detailsUpOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </summary>
                <div className="border-t border-gray-100 pb-4 pt-3">
                  {upcoming.length === 0 ? upcomingEmptyBlock : renderList(upcoming)}
                </div>
              </details>

              <details
                className="group rounded-xl border border-gray-100 bg-gray-50/50"
                open={detailsPastOpen}
                onToggle={(e) => setDetailsPastOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className={sectionHeaderClass}>
                  <span className="flex items-center gap-2">
                    Pasados
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {past.length}
                    </span>
                  </span>
                  <span
                    className={`text-gray-400 transition-transform ${detailsPastOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </summary>
                <div className="border-t border-gray-100 pb-4 pt-3">
                  {past.length === 0 ? pastEmptyBlock : renderList(past)}
                </div>
              </details>
            </div>
          ) : null}

          {!loading && !error && total > 5 ? (
            <div className="px-4 sm:px-6">
              <h2 className="mb-4 mt-2 text-lg font-semibold text-gray-800">Mis eventos</h2>
              <div className="flex gap-0 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                    activeTab === 'upcoming' ? `-mb-px ${brand.tabActive}` : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Próximos
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === 'upcoming' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {upcoming.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('past')}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                    activeTab === 'past' ? `-mb-px ${brand.tabActive}` : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pasados
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === 'past' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {past.length}
                  </span>
                </button>
              </div>
              <div className="pt-4">
                {activeTab === 'upcoming' ? (
                  upcoming.length === 0 ? upcomingEmptyBlock : renderList(upcoming)
                ) : past.length === 0 ? (
                  pastEmptyBlock
                ) : (
                  renderList(past)
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="px-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Eventos a los que fui invitado/a</h2>
            <p className="pb-6 pt-6 text-center text-sm text-gray-400">
              Próximamente podrás ver aquí los eventos a los que has sido invitado.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
