'use client'

// Dashboard home — profile, children, events summary, invited events, favorites
// Route: /dashboard

import AppNav from '@/components/AppNav'
import { ChildrenSection, type DashboardChildRow } from '@/components/ChildrenSection'
import { brand } from '@/lib/brand'
import { CalendarDays, Map as MapIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
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
  location_address: string | null
  invitation_theme: string | null
  invitation_image_url: string | null
}

type RsvpCounts = {
  confirmed: number
  declined: number
  maybe: number
}

type InvitedListItem = {
  eventId: string
  public_slug: string
  title: string
  event_date: string
  child_name: string
  attendance_status: string | null
  invitation_theme: string | null
  invitation_image_url: string | null
}

type ParentProfile = {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

function todayLocalIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function userFirstDisplayName(user: User): string {
  const rawMeta = user.user_metadata?.full_name
  const fullName = typeof rawMeta === 'string' ? rawMeta.trim() : ''
  if (fullName) {
    const first = fullName.split(/\s+/).filter(Boolean)[0]
    if (first) return first
  }
  const email = user.email?.trim() ?? ''
  if (email) {
    const local = email.split('@')[0] ?? ''
    const first = local.split(/[._+\s-]/).filter(Boolean)[0]
    if (first) return first
  }
  return ''
}

function parentAvatarFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const a = meta?.avatar_url
  const p = meta?.picture
  if (typeof a === 'string' && a.trim()) return a.trim()
  if (typeof p === 'string' && p.trim()) return p.trim()
  return null
}

function parentFullNameFromUser(user: User): string | null {
  const raw = user.user_metadata?.full_name
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function initialsFromDisplay(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
    }
    if (parts[0]) {
      return parts[0]!.slice(0, 2).toUpperCase()
    }
  }
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

function formatTimeShort(time: string | null) {
  if (!time || String(time).trim() === '') {
    return null
  }
  return String(time).slice(0, 5)
}

function googleMapsSearchUrl(locationName: string, locationAddress: string | null): string {
  const name = locationName.trim()
  const addr = locationAddress?.trim()
  const query = addr && addr.length > 0 ? addr : name
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** e.g. "10 may 2026" — day + short month + year in Spanish */
function formatEventDayMonthShort(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const d = new Date(year, month - 1, day)
  return d
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .trim()
    .toLowerCase()
}

function eventStatusLabel(eventDate: string, todayStr: string): 'Próximo' | 'Hoy' | 'Pasado' {
  if (eventDate > todayStr) return 'Próximo'
  if (eventDate === todayStr) return 'Hoy'
  return 'Pasado'
}

function statusDotClass(status: 'Próximo' | 'Hoy' | 'Pasado') {
  if (status === 'Hoy') return 'bg-amber-400'
  if (status === 'Pasado') return 'bg-gray-400'
  return 'bg-green-500'
}

function EventRow({
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
  const timeLabel = formatTimeShort(event.start_time)
  const dateShort = formatEventDayMonthShort(event.event_date)
  const loc = event.location_name?.trim()
  const to = `/dashboard/eventos/${event.public_slug}`
  const img = event.invitation_image_url?.trim()
  const isPastEvent = event.event_date < todayStr
  const attendeeLabel =
    rsvpCounts.confirmed === 1
      ? isPastEvent
        ? '1 asistió'
        : '1 confirmado'
      : isPastEvent
        ? `${rsvpCounts.confirmed} asistieron`
        : `${rsvpCounts.confirmed} confirmados`

  return (
    <li className="w-full">
      <Link
        href={to}
        className={`flex w-full flex-row items-center gap-3 rounded-xl border border-gray-100 border-l-4 ${leftBorderClass} bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:ring-2 ${hoverRingClass}`}
      >
        {img ? (
          <img
            src={img}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg leading-none"
            aria-hidden
          >
            🎉
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`}
              aria-hidden
            />
            <span className="shrink-0 text-xs font-medium text-gray-600">{status}</span>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{event.title}</p>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            <span>
              📅 {dateShort}
              {timeLabel ? ` · ${timeLabel}` : ''}
            </span>
            {loc ? (
              <span className="max-w-full min-w-0 truncate" title={loc}>
                📍 {loc}
              </span>
            ) : null}
            <span>
              👥 {attendeeLabel}
            </span>
            {rsvpCounts.declined > 0 ? (
              <span>
                ❌ {rsvpCounts.declined} no pueden
              </span>
            ) : null}
            {rsvpCounts.maybe > 0 ? (
              <span>
                🤔 {rsvpCounts.maybe} aún no saben
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 self-center text-base font-medium text-gray-400" aria-hidden>
          →
        </span>
      </Link>
    </li>
  )
}

type InvitedEventRecord = {
  id: string
  title: string
  event_date: string
  public_slug: string
  user_id: string
  invitation_theme: string | null
  invitation_image_url: string | null
}

function normalizeInvitedNestedEvent(
  raw: InvitedEventRecord | InvitedEventRecord[] | null | undefined
): InvitedEventRecord | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function invitedItemToEventListItem(item: InvitedListItem): EventListItem {
  return {
    id: item.eventId,
    public_slug: item.public_slug,
    title: item.title,
    child_name: item.child_name,
    event_date: item.event_date,
    start_time: null,
    location_name: null,
    location_address: null,
    invitation_theme: item.invitation_theme,
    invitation_image_url: item.invitation_image_url ?? null,
  }
}

export default function DashboardHomePage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [rsvpCountsByEventId, setRsvpCountsByEventId] = useState<Record<string, RsvpCounts>>({})
  const [children, setChildren] = useState<DashboardChildRow[]>([])
  const [invitedItems, setInvitedItems] = useState<InvitedListItem[]>([])
  const [userFirstName, setUserFirstName] = useState('')
  const [userId, setUserId] = useState('')
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProximos, setShowProximos] = useState(true)
  const [showPasados, setShowPasados] = useState(true)

  const todayStr = useMemo(() => todayLocalIso(), [])

  const { upcomingCount, pastCount } = useMemo(() => {
    const upIds = new Set<string>()
    const pastIds = new Set<string>()
    for (const e of events) {
      if (e.event_date >= todayStr) upIds.add(e.id)
      else pastIds.add(e.id)
    }
    for (const i of invitedItems) {
      if (i.event_date >= todayStr) upIds.add(i.eventId)
      else pastIds.add(i.eventId)
    }
    return { upcomingCount: upIds.size, pastCount: pastIds.size }
  }, [events, invitedItems, todayStr])

  const dashboardUpcomingEvents = useMemo((): EventListItem[] => {
    const byId = new Map<string, EventListItem>()
    for (const e of events) {
      if (e.event_date >= todayStr) byId.set(e.id, e)
    }
    for (const item of invitedItems) {
      if (item.event_date >= todayStr && !byId.has(item.eventId)) {
        byId.set(item.eventId, invitedItemToEventListItem(item))
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.event_date.localeCompare(b.event_date))
  }, [events, invitedItems, todayStr])

  const lastPastEvent = useMemo((): EventListItem | null => {
    const byId = new Map<string, EventListItem>()
    for (const e of events) {
      if (e.event_date < todayStr) byId.set(e.id, e)
    }
    for (const item of invitedItems) {
      if (item.event_date < todayStr && !byId.has(item.eventId)) {
        byId.set(item.eventId, invitedItemToEventListItem(item))
      }
    }
    const sorted = Array.from(byId.values()).sort((a, b) => b.event_date.localeCompare(a.event_date))
    return sorted[0] ?? null
  }, [events, invitedItems, todayStr])

  const hasAnyEvents = events.length > 0 || invitedItems.length > 0

  const distinctLocations = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const e of events) {
      const n = e.location_name?.trim()
      if (!n) continue
      if (!m.has(n)) m.set(n, e.location_address?.trim() ?? null)
    }
    return [...m.entries()].map(([name, address]) => ({ name, address })).slice(0, 3)
  }, [events])

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
          setChildren([])
          setInvitedItems([])
          setRsvpCountsByEventId({})
          setUserFirstName('')
          setUserId('')
          setParentProfile(null)
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        setUserId(user.id)
        setUserFirstName(userFirstDisplayName(user))
        setParentProfile({
          email: user.email ?? '',
          fullName: parentFullNameFromUser(user),
          avatarUrl: parentAvatarFromUser(user),
        })
      }

      const [eventsRes, childrenRes] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, public_slug, title, child_name, event_date, start_time, location_name, location_address, invitation_theme, invitation_image_url'
          )
          .eq('user_id', user.id),
        supabase
          .from('children')
          .select('id, name, last_name, birth_date, avatar_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      if (!isMounted) return

      const loadedChildren = (childrenRes.data ?? []) as DashboardChildRow[]
      if (childrenRes.error) {
        setChildren([])
      } else {
        setChildren(loadedChildren)
      }

      if (eventsRes.error) {
        setError(eventsRes.error.message)
        setEvents([])
        setRsvpCountsByEventId({})
        setInvitedItems([])
        setLoading(false)
        return
      }

      const list = (eventsRes.data ?? []) as EventListItem[]
      setEvents(list)

      const childNames = loadedChildren
        .map((c) => `${c.name} ${c.last_name ?? ''}`.trim())
        .filter(Boolean)

      let invited: InvitedListItem[] = []
      if (childNames.length > 0) {
        const { data: invitedRows, error: invitedError } = await supabase
          .from('rsvps')
          .select(
            'event_id, child_name, attendance_status, events ( id, title, event_date, public_slug, user_id, invitation_theme, invitation_image_url )'
          )
          .in('child_name', childNames)

        if (!isMounted) return

        if (!invitedError && invitedRows) {
          const seen = new Set<string>()
          for (const row of invitedRows as {
            event_id: string
            child_name: string
            attendance_status: string | null
            events: InvitedEventRecord | InvitedEventRecord[] | null
          }[]) {
            const ev = normalizeInvitedNestedEvent(row.events)
            if (!ev || ev.user_id === user.id) continue
            const dedupeKey = `${ev.id}|${row.child_name}`
            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)
            invited.push({
              eventId: ev.id,
              public_slug: ev.public_slug,
              title: ev.title,
              event_date: ev.event_date,
              child_name: row.child_name,
              attendance_status: row.attendance_status,
              invitation_theme: ev.invitation_theme,
              invitation_image_url: ev.invitation_image_url ?? null,
            })
          }
          invited.sort((a, b) => (a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0))
        }
      }

      const emptyRsvpCounts = (): RsvpCounts => ({ confirmed: 0, declined: 0, maybe: 0 })
      const byEvent: Record<string, RsvpCounts> = {}

      const allEventIds = [...new Set([...list.map((e) => e.id), ...invited.map((i) => i.eventId)])]
      for (const id of allEventIds) {
        byEvent[id] = emptyRsvpCounts()
      }

      if (allEventIds.length > 0) {
        const { data: rsvpRows, error: rsvpError } = await supabase
          .from('rsvps')
          .select('event_id, attendance_status')
          .in('event_id', allEventIds)

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
        setInvitedItems(invited)
        setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const greetingTitle = userFirstName ? `Hola ${userFirstName} 👋` : 'Hola 👋'

  const profileInitials = parentProfile
    ? initialsFromDisplay(parentProfile.fullName, parentProfile.email)
    : '?'

  return (
    <main className={`min-h-screen ${brand.pageBg} pb-12`}>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{greetingTitle}</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Todos tus eventos y cumpleaños organizados en un solo lugar.
            </p>
          </div>
        </header>

        {parentProfile ? (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8">
            <div className="flex min-h-[7.5rem] flex-row items-center gap-3 rounded-2xl bg-white p-4 shadow-sm sm:gap-4">
              {parentProfile.avatarUrl ? (
                <img
                  src={parentProfile.avatarUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${brand.accentBg} ${brand.accentText}`}
                  aria-hidden
                >
                  {profileInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-gray-900">
                  {parentProfile.fullName ?? 'Tu cuenta'}
                </p>
                <p className="truncate text-sm text-gray-600">{parentProfile.email}</p>
                <span
                  className={`mt-1 inline-block cursor-default text-xs font-medium underline ${brand.accentText}`}
                  title="Próximamente"
                >
                  Editar perfil
                </span>
              </div>
            </div>
            <div
              className="pointer-events-none flex min-h-[7.5rem] cursor-default select-none flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-gray-200 bg-white p-3 text-center shadow-sm"
              aria-disabled
            >
              <Plus className="h-5 w-5 text-gray-300" strokeWidth={2} aria-hidden />
              <p className="text-xs font-medium text-gray-400">Añadir pareja</p>
            </div>
          </div>
        ) : null}

        {userId ? (
          <ChildrenSection userId={userId} initialChildren={children} isLoading={loading} />
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:p-6">
          {loading ? <p className="text-sm text-gray-500">Cargando eventos...</p> : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!loading && !error ? (
            <div className="px-4 sm:px-6">
              <div className="mb-4 mt-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <CalendarDays className="h-4 w-4 shrink-0 text-gray-600" strokeWidth={2} aria-hidden />
                  Eventos
                </h2>
                <Link
                  href="/dashboard/eventos/nuevo"
                  className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium ${brand.buttonPrimary}`}
                >
                  Crear evento
                </Link>
              </div>

              {!hasAnyEvents ? (
                <p className="py-6 text-center text-sm text-gray-500">🎉 Todos tus eventos aparecerán aquí.</p>
              ) : (
                <>
                  <div className="mb-4 grid w-full grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowProximos((v) => !v)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border py-2 px-4 text-left transition ${
                        showProximos
                          ? `bg-white ${brand.borderBrand} shadow-sm`
                          : 'border-gray-200 bg-white opacity-50 text-gray-400'
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${showProximos ? 'text-gray-600' : 'text-gray-400'}`}
                      >
                        Próximos
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          showProximos ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {upcomingCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasados((v) => !v)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border py-2 px-4 text-left transition ${
                        showPasados
                          ? `bg-white ${brand.borderBrand} shadow-sm`
                          : 'border-gray-200 bg-white opacity-50 text-gray-400'
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${showPasados ? 'text-gray-600' : 'text-gray-400'}`}
                      >
                        Pasados
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          showPasados ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {pastCount}
                      </span>
                    </button>
                  </div>

                  {!showProximos && !showPasados ? (
                    <p className="py-6 text-center text-sm text-gray-500">
                      Selecciona Próximos o Pasados para ver tus eventos.
                    </p>
                  ) : (showProximos && dashboardUpcomingEvents.length > 0) ||
                    (showPasados && lastPastEvent) ? (
                    <ul className="mt-3 grid w-full grid-cols-1 gap-3">
                      {showProximos
                        ? dashboardUpcomingEvents.map((event) => (
                            <EventRow
                              key={event.id}
                              event={event}
                              rsvpCounts={
                                rsvpCountsByEventId[event.id] ?? {
                                  confirmed: 0,
                                  declined: 0,
                                  maybe: 0,
                                }
                              }
                              todayStr={todayStr}
                            />
                          ))
                        : null}
                      {showPasados && lastPastEvent ? (
                        <EventRow
                          key={`past-${lastPastEvent.id}`}
                          event={lastPastEvent}
                          rsvpCounts={
                            rsvpCountsByEventId[lastPastEvent.id] ?? {
                              confirmed: 0,
                              declined: 0,
                              maybe: 0,
                            }
                          }
                          todayStr={todayStr}
                        />
                      ) : null}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:p-6">
          <div className="px-4 sm:px-6">
            <h2 className="mb-4 mt-2 text-lg font-semibold text-gray-900">
              <span aria-hidden>📍 </span>
              Ubicaciones
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : distinctLocations.length === 0 ? (
              <p className="text-center text-sm text-gray-400">
                Tus ubicaciones aparecerán aquí una vez crees tu primer evento.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {distinctLocations.map(({ name, address }) => (
                  <a
                    key={name}
                    href={googleMapsSearchUrl(name, address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex min-h-[64px] flex-col justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 pr-8 pb-6 transition hover:border-yellow-200 hover:bg-yellow-50/50 hover:shadow-sm"
                  >
                    <p className="text-sm font-medium text-gray-700">{name}</p>
                    {address ? (
                      <p className="mt-0.5 truncate text-xs text-gray-400" title={address}>
                        {address}
                      </p>
                    ) : null}
                    <MapIcon
                      className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 text-gray-400"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="sr-only">Abrir en Google Maps</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
