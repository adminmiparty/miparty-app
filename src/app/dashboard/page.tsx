'use client'

// Dashboard home — profile, children, events summary, invited events, favorites
// Route: /dashboard

import { ChildrenSection, type DashboardChildRow } from '@/components/ChildrenSection'
import { brand } from '@/lib/brand'
import { Plus } from 'lucide-react'
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
  invitation_theme: string | null
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

function formatTimeShort(time: string | null) {
  if (!time || String(time).trim() === '') {
    return null
  }
  return String(time).slice(0, 5)
}

/** e.g. "10 may" — day + short month in Spanish */
function formatEventDayMonthShort(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const d = new Date(year, month - 1, day)
  return d
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .trim()
    .toLowerCase()
}

function invitedAttendanceLabel(status: string | null) {
  if (status === 'confirmed') return 'Confirmado'
  if (status === 'declined') return 'No puede'
  if (status === 'maybe') return 'Quizá'
  return 'Pendiente'
}

function invitedAttendanceBadgeClass(status: string | null) {
  if (status === 'confirmed') return 'bg-green-100 text-green-800'
  if (status === 'declined') return 'bg-red-100 text-red-800'
  if (status === 'maybe') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
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
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>
            📅 {dateShort}
            {timeLabel ? ` ${timeLabel}` : ''}
          </span>
          {loc ? (
            <span className="max-w-full min-w-0 truncate" title={loc}>
              📍 {loc}
            </span>
          ) : null}
          <span>
            👥 {rsvpCounts.confirmed} confirmados
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
}

function normalizeInvitedNestedEvent(
  raw: InvitedEventRecord | InvitedEventRecord[] | null | undefined
): InvitedEventRecord | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
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

  const todayStr = useMemo(() => todayLocalIso(), [])

  const eventsSortedDesc = useMemo(() => {
    return [...events].sort((a, b) => (a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0))
  }, [events])

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

  const totalConfirmedRsvps = useMemo(
    () => Object.values(rsvpCountsByEventId).reduce((sum, c) => sum + c.confirmed, 0),
    [rsvpCountsByEventId]
  )

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
            'id, public_slug, title, child_name, event_date, start_time, location_name, invitation_theme'
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

      const childNames = loadedChildren
        .map((c) => `${c.name} ${c.last_name ?? ''}`.trim())
        .filter(Boolean)

      let invited: InvitedListItem[] = []
      if (childNames.length > 0) {
        const { data: invitedRows, error: invitedError } = await supabase
          .from('rsvps')
          .select(
            'event_id, child_name, attendance_status, events ( id, title, event_date, public_slug, user_id, invitation_theme )'
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
            })
          }
          invited.sort((a, b) => (a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0))
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

  const newEventPlusLink = (
    <Link
      href="/dashboard/eventos/nuevo"
      className={`inline-flex shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-yellow-50 ${brand.accentText} ${brand.textBrandHover}`}
      aria-label="Crear nueva fiesta"
    >
      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
    </Link>
  )

  const misEventosHeadingRow = (
    <div className="mb-4 mt-2 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-gray-800">Mis eventos</h2>
      {newEventPlusLink}
    </div>
  )

  const greetingTitle = userFirstName ? `Hola, ${userFirstName} 👋` : 'Hola 👋'
  const navBrandLine = userFirstName ? `MiParty · ${userFirstName}` : 'MiParty'

  const profileInitials = parentProfile
    ? initialsFromDisplay(parentProfile.fullName, parentProfile.email)
    : '?'

  return (
    <main className={`min-h-screen ${brand.pageBg} pb-12`}>
      <div className={`sticky top-0 z-50 w-full ${brand.navBorder} ${brand.navBg} shadow-sm backdrop-blur-sm`}>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <span className={`text-sm font-bold ${brand.textBrand}`}>MiParty</span>
          <span className={`text-sm font-bold ${brand.textBrand}`}>{navBrandLine}</span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <header className="mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{greetingTitle}</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">
              Tus fiestas y cumpleaños organizados en un solo lugar.
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
              className="pointer-events-none flex min-h-[7.5rem] select-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-4 text-center shadow-sm"
              aria-disabled
            >
              <Plus className="h-5 w-5 text-gray-300" strokeWidth={2} aria-hidden />
              <p className="text-xs font-medium text-gray-500">Añadir pareja</p>
              <p className="text-[10px] text-gray-400">o co-organizador · próximamente</p>
            </div>
          </div>
        ) : null}

        {userId ? (
          <ChildrenSection userId={userId} initialChildren={children} isLoading={loading} />
        ) : null}

        {!loading && !error ? (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6">
            <div
              className={`rounded-lg border ${brand.borderLight} ${brand.accentBg} px-3 py-2 text-sm text-gray-700 shadow-sm`}
            >
              <span className="text-gray-600">Próximos:</span>{' '}
              <span className={`font-semibold tabular-nums ${brand.accentText}`}>{upcoming.length}</span>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
              <span className="text-gray-600">Pasados:</span>{' '}
              <span className="font-semibold tabular-nums text-gray-800">{past.length}</span>
            </div>
            <div
              className={`rounded-lg border ${brand.borderLight} ${brand.accentBg} px-3 py-2 text-sm text-gray-700 shadow-sm`}
            >
              <span className="text-gray-600">Confirmados:</span>{' '}
              <span className={`font-semibold tabular-nums ${brand.accentText}`}>{totalConfirmedRsvps}</span>
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:p-6">
          {loading ? <p className="text-sm text-gray-500">Cargando eventos...</p> : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!loading && !error ? (
            <div className="px-4 sm:px-6">
              {misEventosHeadingRow}
              {total === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center">
                  <p className="text-2xl" aria-hidden>
                    🎉
                  </p>
                  <p className="mt-3 text-sm font-medium text-gray-700">Aún no has creado ninguna fiesta.</p>
                  <Link
                    href="/dashboard/eventos/nuevo"
                    className={`mt-3 inline-block text-sm font-medium underline ${brand.accentText} ${brand.textBrandHover}`}
                  >
                    Crea tu primera fiesta →
                  </Link>
                </div>
              ) : (
                <ul className="grid w-full grid-cols-1 gap-3">
                  {eventsSortedDesc.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      rsvpCounts={rsvpCountsByEventId[event.id] ?? { confirmed: 0, declined: 0, maybe: 0 }}
                      todayStr={todayStr}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Eventos a los que mis hijos fueron invitados</h2>
          {!loading && invitedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center">
              <p className="text-2xl" aria-hidden>
                🎈
              </p>
              <p className="mt-3 text-sm font-medium text-gray-700">Aún no aparecen eventos aquí.</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-500">
                Cuando tus hijos sean invitados a fiestas y confirmen asistencia, aparecerán aquí.
              </p>
            </div>
          ) : null}
          {!loading && invitedItems.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3">
              {invitedItems.map((item) => {
                const themeKey = item.invitation_theme ?? 'yellow'
                const leftBorder = themeCardBorder[themeKey] ?? themeCardBorder.yellow
                return (
                  <li key={`${item.eventId}-${item.child_name}`} className="w-full">
                    <Link
                      href={`/e/${item.public_slug}`}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 border-l-4 ${leftBorder} bg-white p-4 shadow-sm transition-shadow hover:shadow-md`}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-base font-bold text-gray-900">{item.title}</p>
                        <p className="mt-0.5 text-sm text-gray-700">{item.child_name}</p>
                        <p className="mt-1 text-sm text-gray-600">{formatSpanishDateMedium(item.event_date)}</p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invitedAttendanceBadgeClass(item.attendance_status)}`}
                        >
                          {invitedAttendanceLabel(item.attendance_status)}
                        </span>
                      </div>
                      <span className="shrink-0 text-lg text-gray-400" aria-hidden>
                        →
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-medium text-gray-700">
            <span aria-hidden>📍 </span>
            Ubicaciones favoritas
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Próximamente podrás guardar tus lugares habituales para no tener que escribirlos cada vez.
          </p>
        </section>
      </div>
    </main>
  )
}
