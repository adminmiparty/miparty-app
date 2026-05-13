'use client'

// Eventos list — all organized parties
// Route: /dashboard/eventos

import AppNav from '@/components/AppNav'
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
  start_time: string | null
  location_name: string | null
  invitation_theme: string | null
}

type RsvpCounts = {
  confirmed: number
  declined: number
  maybe: number
}

function todayLocalIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatSpanishDateMedium(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  const raw = date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function eventStatusLabel(eventDate: string, todayStr: string): 'Próximo' | 'Hoy' | 'Pasado' {
  if (eventDate > todayStr) return 'Próximo'
  if (eventDate === todayStr) return 'Hoy'
  return 'Pasado'
}

function eventStatusBadgeClass(status: 'Próximo' | 'Hoy' | 'Pasado') {
  if (status === 'Hoy') return 'bg-amber-100 text-amber-800'
  if (status === 'Pasado') return brand.badgePasado
  return brand.badgeProximo
}

function EventListCard({
  event,
  rsvpCounts,
  todayStr,
}: {
  event: EventListItem
  rsvpCounts: RsvpCounts
  todayStr: string
}) {
  const status = eventStatusLabel(event.event_date, todayStr)
  const themeKey = event.invitation_theme ?? 'yellow'
  const leftBorderClass = themeCardBorder[themeKey] ?? themeCardBorder.yellow
  const hoverRingClass = themeRingMap[themeKey] ?? themeRingMap.yellow
  const loc = event.location_name?.trim()

  return (
    <li className="w-full">
      <Link
        href={`/dashboard/eventos/${event.public_slug}`}
        className={`flex w-full flex-col gap-1.5 rounded-xl border border-gray-100 border-l-4 ${leftBorderClass} bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:ring-2 ${hoverRingClass}`}
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${eventStatusBadgeClass(status)}`}
          >
            {status}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{event.title}</p>
          <span className="shrink-0 text-base font-medium text-gray-400" aria-hidden>
            →
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>📅 {formatSpanishDateMedium(event.event_date)}</span>
          <span className="max-w-full min-w-0 truncate" title={loc ?? undefined}>
            📍 {loc ?? '—'}
          </span>
          <span>👥 {rsvpCounts.confirmed}</span>
          <span>❌ {rsvpCounts.declined}</span>
          <span>🤔 {rsvpCounts.maybe}</span>
        </div>
      </Link>
    </li>
  )
}

export default function EventosListPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [rsvpCountsByEventId, setRsvpCountsByEventId] = useState<Record<string, RsvpCounts>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [detailsUpOpen, setDetailsUpOpen] = useState(true)
  const [detailsPastOpen, setDetailsPastOpen] = useState(false)
  const [invitedActiveTab, setInvitedActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [invitedDetailsUpOpen, setInvitedDetailsUpOpen] = useState(true)
  const [invitedDetailsPastOpen, setInvitedDetailsPastOpen] = useState(false)

  const todayStr = useMemo(() => todayLocalIso(), [])

  const { invitedUpcoming, invitedPast, invitedTotal } = useMemo(() => {
    const invitedEvents: EventListItem[] = []
    const up: EventListItem[] = []
    const pa: EventListItem[] = []
    for (const e of invitedEvents) {
      if (e.event_date >= todayStr) up.push(e)
      else pa.push(e)
    }
    up.sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0))
    pa.sort((a, b) => (a.event_date > b.event_date ? -1 : a.event_date < b.event_date ? 1 : 0))
    return { invitedUpcoming: up, invitedPast: pa, invitedTotal: invitedEvents.length }
  }, [todayStr])

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
    if (!loading && !error) {
      setInvitedDetailsPastOpen(invitedPast.length > 0)
    }
  }, [loading, error, invitedPast.length])

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
          setEvents([])
          setRsvpCountsByEventId({})
          setLoading(false)
        }
        return
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select(
          'id, public_slug, title, child_name, event_date, start_time, location_name, invitation_theme'
        )
        .eq('user_id', user.id)

      if (!isMounted) return

      if (eventsError) {
        setError(eventsError.message)
        setEvents([])
        setRsvpCountsByEventId({})
        setLoading(false)
        return
      }

      const list = (data ?? []) as EventListItem[]
      setEvents(list)

      const emptyRsvpCounts = (): RsvpCounts => ({ confirmed: 0, declined: 0, maybe: 0 })
      const byEvent: Record<string, RsvpCounts> = {}
      if (list.length > 0) {
        const ids = list.map((e) => e.id)
        for (const id of ids) {
          byEvent[id] = emptyRsvpCounts()
        }
        const { data: rsvpRows, error: rsvpError } = await supabase
          .from('rsvps')
          .select('event_id, attendance_status')
          .in('event_id', ids)

        if (!isMounted) return

        if (!rsvpError && rsvpRows) {
          for (const row of rsvpRows as { event_id: string; attendance_status: string | null }[]) {
            const id = row.event_id
            const bucket = byEvent[id]
            if (!bucket) continue
            const s = row.attendance_status
            if (s === 'confirmed') bucket.confirmed += 1
            else if (s === 'declined') bucket.declined += 1
            else if (s === 'maybe') bucket.maybe += 1
          }
        }
      }

      if (isMounted) {
        setRsvpCountsByEventId(byEvent)
        setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const sectionHeaderClass =
    'flex w-full cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-left font-semibold text-gray-900 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden'

  const renderList = (list: EventListItem[]) => (
    <ul className="grid w-full grid-cols-1 gap-3">
      {list.map((event) => (
        <EventListCard
          key={event.id}
          event={event}
          rsvpCounts={rsvpCountsByEventId[event.id] ?? { confirmed: 0, declined: 0, maybe: 0 }}
          todayStr={todayStr}
        />
      ))}
    </ul>
  )

  const upcomingEmpty = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">No tienes fiestas próximas.</p>
    </div>
  )

  const pastEmpty = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">Aún no tienes fiestas pasadas.</p>
    </div>
  )

  const invitedUpcomingEmpty = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">
        <span className="text-lg" aria-hidden>
          🎈{' '}
        </span>
        Aún no tienes fiestas próximas a las que tus hijos hayan sido invitados.
      </p>
    </div>
  )

  const invitedPastEmpty = (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-600">Aún no tienes fiestas pasadas.</p>
    </div>
  )

  return (
    <main className={`min-h-screen ${brand.pageBg} pb-12`}>
      <AppNav backHref="/dashboard" backLabel="⬅️ Mi espacio" />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Eventos</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">Todas tus fiestas organizadas</p>
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

          {!loading && !error ? (
            <>
              <h2 className="mb-4 px-4 text-lg font-semibold text-gray-800 sm:px-6">Mis eventos</h2>

              {total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center">
              <p className="text-3xl" aria-hidden>
                🎉
              </p>
              <p className="mt-3 text-sm font-medium text-gray-700">Aún no has creado ninguna fiesta.</p>
              <Link
                href="/dashboard/eventos/nuevo"
                className={`mt-4 inline-block text-sm font-semibold underline ${brand.accentText} ${brand.textBrandHover}`}
              >
                Crea tu primera fiesta →
              </Link>
            </div>
              ) : null}

              {total > 0 && total <= 5 ? (
            <div className="space-y-6 px-4 sm:px-6">
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
                  {upcoming.length === 0 ? upcomingEmpty : renderList(upcoming)}
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
                  {past.length === 0 ? pastEmpty : renderList(past)}
                </div>
              </details>
            </div>
              ) : null}

              {total > 5 ? (
            <div className="px-4 sm:px-6">
              <div className="flex gap-0 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                    activeTab === 'upcoming'
                      ? `-mb-px ${brand.tabActive}`
                      : brand.tabInactive
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
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                    activeTab === 'past' ? `-mb-px ${brand.tabActive}` : brand.tabInactive
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
                {activeTab === 'upcoming'
                  ? upcoming.length === 0
                    ? upcomingEmpty
                    : renderList(upcoming)
                  : past.length === 0
                    ? pastEmpty
                    : renderList(past)}
              </div>
            </div>
              ) : null}
            </>
          ) : null}
        </section>

        {!loading && !error ? (
          <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:p-6">
            <h2 className="mb-4 px-4 text-lg font-semibold text-gray-800 sm:px-6">
              Eventos a los que mis hijos fueron invitados
            </h2>

            {invitedTotal <= 5 ? (
              <div className="space-y-6 px-4 sm:px-6">
                <details
                  className="group rounded-xl border border-gray-100 bg-gray-50/50"
                  open={invitedDetailsUpOpen}
                  onToggle={(e) => setInvitedDetailsUpOpen((e.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary className={sectionHeaderClass}>
                    <span className="flex items-center gap-2">
                      Próximos
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                        {invitedUpcoming.length}
                      </span>
                    </span>
                    <span
                      className={`text-gray-400 transition-transform ${invitedDetailsUpOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 pb-4 pt-3">
                    {invitedUpcoming.length === 0 ? invitedUpcomingEmpty : renderList(invitedUpcoming)}
                  </div>
                </details>

                <details
                  className="group rounded-xl border border-gray-100 bg-gray-50/50"
                  open={invitedDetailsPastOpen}
                  onToggle={(e) => setInvitedDetailsPastOpen((e.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary className={sectionHeaderClass}>
                    <span className="flex items-center gap-2">
                      Pasados
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {invitedPast.length}
                      </span>
                    </span>
                    <span
                      className={`text-gray-400 transition-transform ${invitedDetailsPastOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 pb-4 pt-3">
                    {invitedPast.length === 0 ? invitedPastEmpty : renderList(invitedPast)}
                  </div>
                </details>
              </div>
            ) : (
              <div className="px-4 sm:px-6">
                <div className="flex gap-0 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setInvitedActiveTab('upcoming')}
                    className={`flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                      invitedActiveTab === 'upcoming'
                        ? `-mb-px ${brand.tabActive}`
                        : brand.tabInactive
                    }`}
                  >
                    Próximos
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        invitedActiveTab === 'upcoming' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {invitedUpcoming.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvitedActiveTab('past')}
                    className={`flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3 text-sm font-semibold transition sm:text-base lg:px-6 ${
                      invitedActiveTab === 'past' ? `-mb-px ${brand.tabActive}` : brand.tabInactive
                    }`}
                  >
                    Pasados
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        invitedActiveTab === 'past' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {invitedPast.length}
                    </span>
                  </button>
                </div>
                <div className="pt-4">
                  {invitedActiveTab === 'upcoming'
                    ? invitedUpcoming.length === 0
                      ? invitedUpcomingEmpty
                      : renderList(invitedUpcoming)
                    : invitedPast.length === 0
                      ? invitedPastEmpty
                      : renderList(invitedPast)}
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  )
}
