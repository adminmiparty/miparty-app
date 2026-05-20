'use client'

// Eventos list — all organized parties
// Route: /dashboard/eventos

import AppNav from '@/components/AppNav'
import { brand } from '@/lib/brand'
import { formatSpanishDateMedium } from '@/lib/dates'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EVENT_STATUS_DRAFT, isActiveEventStatus } from '@/lib/eventLifecycle'

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
  status?: string | null
}

type DraftEventRow = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string | null
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
        className={`card-soft flex w-full flex-col gap-1.5 border-l-4 ${leftBorderClass} p-3 transition-shadow hover:shadow-[var(--shadow-card-hover)] hover:ring-2 ${hoverRingClass}`}
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
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [draftEvents, setDraftEvents] = useState<DraftEventRow[]>([])
  const [userId, setUserId] = useState('')
  const [showCreateEventDraftModal, setShowCreateEventDraftModal] = useState(false)
  const [createEventNextHref, setCreateEventNextHref] = useState('/dashboard/eventos/nuevo')
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<DraftEventRow | null>(null)
  const [draftDeleteBusy, setDraftDeleteBusy] = useState(false)
  const [draftDeletedToast, setDraftDeletedToast] = useState(false)
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

  const requestCreateEvent = useCallback(
    (href: string) => {
      if (draftEvents.length >= 1) {
        setCreateEventNextHref(href)
        setShowCreateEventDraftModal(true)
      } else {
        router.push(href)
      }
    },
    [draftEvents.length, router]
  )

  const confirmDeleteDraft = useCallback(async () => {
    if (!draftDeleteTarget || !userId) return
    const id = draftDeleteTarget.id
    setDraftDeleteBusy(true)
    const { error: delError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', EVENT_STATUS_DRAFT)
    setDraftDeleteBusy(false)
    setDraftDeleteTarget(null)
    if (!delError) {
      setDraftEvents((prev) => prev.filter((d) => d.id !== id))
      setDraftDeletedToast(true)
      window.setTimeout(() => setDraftDeletedToast(false), 2500)
    }
  }, [draftDeleteTarget, userId, supabase])

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
          setDraftEvents([])
          setUserId('')
          setRsvpCountsByEventId({})
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        setUserId(user.id)
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select(
          'id, public_slug, title, child_name, event_date, start_time, location_name, invitation_theme, status'
        )
        .eq('user_id', user.id)

      if (!isMounted) return

      if (eventsError) {
        setError(eventsError.message)
        setEvents([])
        setDraftEvents([])
        setRsvpCountsByEventId({})
        setLoading(false)
        return
      }

      const rawList = (data ?? []) as EventListItem[]
      const activeList = rawList.filter((e) => isActiveEventStatus(e.status))
      const draftList: DraftEventRow[] = rawList
        .filter((e) => (e.status ?? '') === EVENT_STATUS_DRAFT)
        .map((e) => ({
          id: e.id,
          public_slug: e.public_slug,
          title: e.title,
          child_name: e.child_name,
          event_date: e.event_date,
          start_time: e.start_time,
        }))
        .sort((a, b) => b.event_date.localeCompare(a.event_date))

      setEvents(activeList)
      setDraftEvents(draftList)

      const list = activeList

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
      <AppNav backHref="/dashboard" backLabel="⬅️ Mi panel" />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Eventos</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">Todas tus fiestas organizadas</p>
          </div>
          <button
            type="button"
            onClick={() => requestCreateEvent('/dashboard/eventos/nuevo')}
            className={`inline-flex shrink-0 items-center justify-center rounded-lg ${brand.buttonPrimary} px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition sm:self-start`}
          >
            + Crear nueva fiesta
          </button>
        </header>

        {!loading && !error && draftEvents.length > 0 ? (
          <section className="card-soft mb-6 border border-dashed border-gray-200 bg-gray-50/90 p-4 sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-700">Borradores</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {draftEvents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                        Borrador
                      </span>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{d.title}</p>
                      <p className="truncate text-xs text-gray-500">{d.child_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftDeleteTarget(d)}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-700"
                      aria-label="Eliminar borrador"
                    >
                      🗑️
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/eventos/nuevo?draftId=${d.id}`)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                  >
                    Continuar editando
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card-soft p-4 sm:p-6">
          {loading ? <p className="text-sm text-gray-500">Cargando eventos...</p> : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!loading && !error ? (
            <>
              <h2 className="mb-4 px-4 text-lg font-semibold text-gray-800 sm:px-6">Mis eventos</h2>

              {total === 0 && draftEvents.length > 0 ? (
                <p className="mb-4 px-4 text-sm text-gray-600 sm:px-6">
                  Tus borradores están arriba. Aún no tienes fiestas publicadas.
                </p>
              ) : null}

              {total === 0 && draftEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center">
              <p className="text-3xl" aria-hidden>
                🎉
              </p>
              <p className="mt-3 text-sm font-medium text-gray-700">Aún no has creado ninguna fiesta.</p>
              <button
                type="button"
                onClick={() => requestCreateEvent('/dashboard/eventos/nuevo')}
                className={`mt-4 inline-block text-sm font-semibold underline ${brand.accentText} ${brand.textBrandHover}`}
              >
                Crea tu primera fiesta →
              </button>
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
          <section className="card-soft mt-8 p-4 sm:p-6">
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

      {draftDeletedToast ? (
        <p
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          Borrador eliminado
        </p>
      ) : null}

      {showCreateEventDraftModal ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateEventDraftModal(false)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eventos-create-draft-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateEventDraftModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="eventos-create-draft-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {draftEvents.length > 1 ? 'Tienes borradores pendientes' : 'Tienes un evento en borrador'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Puedes seguir donde lo dejaste o crear un evento nuevo.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2">
              {draftEvents.length > 1
                ? draftEvents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setShowCreateEventDraftModal(false)
                        router.push(`/dashboard/eventos/nuevo?draftId=${d.id}`)
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:bg-[var(--brand-primary-light)]"
                    >
                      <span className="text-xs font-medium text-gray-500">Continuar borrador</span>
                      <span className="mt-0.5 block line-clamp-2 text-sm font-semibold text-gray-900">
                        {d.title}
                      </span>
                    </button>
                  ))
                : draftEvents[0] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateEventDraftModal(false)
                        router.push(`/dashboard/eventos/nuevo?draftId=${draftEvents[0].id}`)
                      }}
                      className={`w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${brand.buttonPrimary}`}
                    >
                      Continuar borrador
                    </button>
                  ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowCreateEventDraftModal(false)
                  router.push(createEventNextHref)
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                Crear evento nuevo
              </button>
              <button
                type="button"
                onClick={() => setShowCreateEventDraftModal(false)}
                className="w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draftDeleteTarget ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !draftDeleteBusy && setDraftDeleteTarget(null)}
          role="presentation"
        >
          <div
            className="relative mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eventos-delete-draft-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={draftDeleteBusy}
              onClick={() => setDraftDeleteTarget(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="eventos-delete-draft-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              ¿Eliminar borrador?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Este borrador se eliminará de tu perfil.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={draftDeleteBusy}
                onClick={() => setDraftDeleteTarget(null)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto sm:min-w-[7.5rem]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={draftDeleteBusy}
                onClick={() => void confirmDeleteDraft()}
                className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60 sm:w-auto sm:min-w-[7.5rem]"
              >
                {draftDeleteBusy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  )
}
