'use client'

// Dashboard home — profile, children, events summary, invited events, favorites
// Route: /dashboard

import AppNav from '@/components/AppNav'
import { ChildrenSection, type DashboardChildRow } from '@/components/ChildrenSection'
import { brand } from '@/lib/brand'
import { CalendarDays, Map as MapIcon, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
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

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function sanitizeDialPrefix(raw: string): string {
  const digitsPlus = raw.replace(/[^\d+]/g, '')
  if (digitsPlus.length === 0) return ''
  let body = digitsPlus.startsWith('+') ? digitsPlus.slice(1) : digitsPlus
  body = body.replace(/\+/g, '')
  return ('+' + body).slice(0, 5)
}

function splitDialPhone(full: string | null): {
  countryCode: '+34' | '+57' | 'otro'
  customCode: string
  number: string
} {
  const trimmed = (full ?? '').trim()
  if (!trimmed) return { countryCode: '+34', customCode: '', number: '' }
  if (trimmed.startsWith('+57')) {
    return { countryCode: '+57', customCode: '', number: trimmed.slice(3) }
  }
  if (trimmed.startsWith('+34')) {
    return { countryCode: '+34', customCode: '', number: trimmed.slice(3) }
  }
  const match = trimmed.match(/^(\+\d{1,5})(\d[\d\s]*)$/)
  if (match && match[1].length <= 5) {
    return { countryCode: 'otro', customCode: match[1], number: match[2].replace(/\s/g, '') }
  }
  return { countryCode: 'otro', customCode: '', number: trimmed.replace(/^\+/, '') }
}

function resolveDialCode(countryCode: string, customCode: string): string {
  return countryCode === 'otro' ? sanitizeDialPrefix(customCode) : countryCode
}

function dialCodeShortLabel(code: string): string {
  if (code === '+57') return '🇨🇴 +57'
  if (code === 'otro') return '✏️ Otro'
  return '🇪🇸 +34'
}

function formatDisplayToIsoDate(displayDate: string) {
  const match = displayDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  const dayNumber = Number.parseInt(day, 10)
  const monthNumber = Number.parseInt(month, 10)
  const yearNumber = Number.parseInt(year, 10)
  if (
    Number.isNaN(dayNumber) ||
    Number.isNaN(monthNumber) ||
    Number.isNaN(yearNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null
  }
  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber)
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() + 1 !== monthNumber ||
    parsed.getDate() !== dayNumber
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function isoToBirthParts(iso: string | null): { day: string; month: string; year: string } {
  if (!iso?.match(/^\d{4}-\d{2}-\d{2}$/)) return { day: '', month: '', year: '' }
  const [y, m, d] = iso.split('-')
  return { day: d, month: m, year: y }
}

function splitFullName(full: string | null): { first: string; last: string } {
  if (!full?.trim()) return { first: '', last: '' }
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0]!, last: '' }
  return { first: parts[0]!, last: parts.slice(1).join(' ') }
}

function isGoogleUser(user: User): boolean {
  if (user.app_metadata?.provider === 'google') return true
  return user.identities?.some((identity) => identity.provider === 'google') === true
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
  const [parentAvatarError, setParentAvatarError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProximos, setShowProximos] = useState(true)
  const [showPasados, setShowPasados] = useState(true)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [userDbProfile, setUserDbProfile] = useState<{
    full_name: string | null
    phone: string | null
    birth_date: string | null
  } | null>(null)
  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profileBirthDay, setProfileBirthDay] = useState('')
  const [profileBirthMonth, setProfileBirthMonth] = useState('')
  const [profileBirthYear, setProfileBirthYear] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileEmailInitial, setProfileEmailInitial] = useState('')
  const [profileCountryCode, setProfileCountryCode] = useState<string>('+34')
  const [profileCustomCode, setProfileCustomCode] = useState('')
  const [profilePhoneNumber, setProfilePhoneNumber] = useState('')
  const [profileInitialPhone, setProfileInitialPhone] = useState('')
  const [profileIsGoogle, setProfileIsGoogle] = useState(false)
  const [profileDialOpen, setProfileDialOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccessToast, setProfileSuccessToast] = useState(false)
  const [profilePhoneNotice, setProfilePhoneNotice] = useState(false)
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [profileNewPassword, setProfileNewPassword] = useState('')
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('')
  const profileDialRef = useRef<HTMLDivElement>(null)

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
          setAuthUser(null)
          setUserDbProfile(null)
          setParentProfile(null)
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        setUserId(user.id)
        setAuthUser(user)
        setUserFirstName(userFirstDisplayName(user))
      }

      const [eventsRes, childrenRes, userRowRes] = await Promise.all([
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
        supabase.from('users').select('full_name, phone, birth_date').eq('id', user.id).maybeSingle(),
      ])

      if (isMounted) {
        const userRow = userRowRes.data as {
          full_name: string | null
          phone: string | null
          birth_date: string | null
        } | null
        setUserDbProfile(userRow ?? null)
        const displayFull =
          userRow?.full_name?.trim() || parentFullNameFromUser(user) || null
        setParentProfile({
          email: user.email ?? '',
          fullName: displayFull,
          avatarUrl: parentAvatarFromUser(user),
        })
      }

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

  useEffect(() => {
    if (!profileDialOpen) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (profileDialRef.current?.contains(target)) return
      setProfileDialOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [profileDialOpen])

  useEffect(() => {
    if (!profileSuccessToast) return
    const t = setTimeout(() => {
      setProfileSuccessToast(false)
      setProfilePhoneNotice(false)
    }, 3000)
    return () => clearTimeout(t)
  }, [profileSuccessToast])

  const openProfileModal = () => {
    const full =
      userDbProfile?.full_name?.trim() ||
      parentProfile?.fullName?.trim() ||
      (authUser ? parentFullNameFromUser(authUser) : null)
    const { first, last } = splitFullName(full)
    setProfileFirstName(first)
    setProfileLastName(last)
    const birth = isoToBirthParts(userDbProfile?.birth_date ?? null)
    setProfileBirthDay(birth.day)
    setProfileBirthMonth(birth.month)
    setProfileBirthYear(birth.year)
    const email = parentProfile?.email ?? ''
    setProfileEmail(email)
    setProfileEmailInitial(email)
    const phone = userDbProfile?.phone ?? ''
    setProfileInitialPhone(phone)
    const dial = splitDialPhone(phone)
    setProfileCountryCode(dial.countryCode)
    setProfileCustomCode(dial.customCode)
    setProfilePhoneNumber(dial.number)
    setProfileIsGoogle(authUser ? isGoogleUser(authUser) : false)
    setShowPasswordSection(false)
    setProfileNewPassword('')
    setProfileConfirmPassword('')
    setProfileError(null)
    setProfilePhoneNotice(false)
    setShowProfileModal(true)
  }

  const handleProfileSave = async () => {
    if (!userId) return
    setProfileError(null)
    setProfileSaving(true)

    const trimmedFirst = profileFirstName.trim()
    const trimmedLast = profileLastName.trim()
    if (!trimmedFirst) {
      setProfileError('El nombre es obligatorio.')
      setProfileSaving(false)
      return
    }

    const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst
    let birthIso: string | null = null
    if (profileBirthDay || profileBirthMonth || profileBirthYear) {
      if (!profileBirthDay || !profileBirthMonth || !profileBirthYear) {
        setProfileError('Completa día, mes y año de nacimiento, o déjalos todos vacíos.')
        setProfileSaving(false)
        return
      }
      birthIso = formatDisplayToIsoDate(
        `${profileBirthDay}/${profileBirthMonth}/${profileBirthYear}`
      )
      if (!birthIso) {
        setProfileError('La fecha de nacimiento no es válida.')
        setProfileSaving(false)
        return
      }
    }

    const finalDial = resolveDialCode(profileCountryCode, profileCustomCode)
    if (profileCountryCode === 'otro' && profilePhoneNumber.trim() && finalDial.length <= 1) {
      setProfileError('Indica el prefijo internacional (ej. +44).')
      setProfileSaving(false)
      return
    }
    const trimmedPhone = profilePhoneNumber.trim()
    const fullPhone = trimmedPhone ? `${finalDial}${trimmedPhone}` : null
    const phoneChanged = (fullPhone ?? '') !== (profileInitialPhone ?? '')

    const { error: upsertError } = await supabase.from('users').upsert({
      id: userId,
      full_name: fullName,
      phone: fullPhone,
      birth_date: birthIso,
    })

    if (upsertError) {
      setProfileError(upsertError.message)
      setProfileSaving(false)
      return
    }

    const trimmedEmail = profileEmail.trim()
    if (!profileIsGoogle && trimmedEmail && trimmedEmail !== profileEmailInitial) {
      const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (emailError) {
        setProfileError(emailError.message)
        setProfileSaving(false)
        return
      }
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    })
    if (metaError) {
      setProfileError(metaError.message)
      setProfileSaving(false)
      return
    }

    setUserDbProfile({ full_name: fullName, phone: fullPhone, birth_date: birthIso })
    setProfileInitialPhone(fullPhone ?? '')
    setParentProfile((prev) =>
      prev
        ? {
            ...prev,
            fullName,
            email: profileIsGoogle ? prev.email : trimmedEmail || prev.email,
          }
        : prev
    )
    const firstFromFull = fullName.split(/\s+/).filter(Boolean)[0]
    if (firstFromFull) setUserFirstName(firstFromFull)

    setProfilePhoneNotice(phoneChanged)
    setShowProfileModal(false)
    setProfileSuccessToast(true)
    setProfileSaving(false)
  }

  const handleUpdatePassword = async () => {
    setProfileError(null)
    if (!profileNewPassword || profileNewPassword !== profileConfirmPassword) {
      setProfileError('Las contraseñas no coinciden.')
      return
    }
    setProfileSaving(true)
    const { error: pwError } = await supabase.auth.updateUser({ password: profileNewPassword })
    if (pwError) {
      setProfileError(pwError.message)
      setProfileSaving(false)
      return
    }
    setProfileNewPassword('')
    setProfileConfirmPassword('')
    setShowPasswordSection(false)
    setProfileSaving(false)
    setProfileSuccessToast(true)
  }

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
              {parentProfile.avatarUrl && !parentAvatarError ? (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
                  <img
                    src={parentProfile.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setParentAvatarError(true)}
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${brand.accentBg} ${brand.accentText}`}
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
                <button
                  type="button"
                  onClick={openProfileModal}
                  className={`mt-1 inline-block text-xs font-medium underline ${brand.accentText} ${brand.textBrandHover}`}
                >
                  Editar perfil
                </button>
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

      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-white pt-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <div className="overflow-y-auto px-6 pb-6">
              <div className="mb-4 mt-1 flex items-center justify-between">
                <h2 id="profile-modal-title" className="text-lg font-semibold text-gray-900">
                  Mi perfil
                </h2>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="profileFirstName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre
                  </label>
                  <input
                    id="profileFirstName"
                    type="text"
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>

                <div>
                  <label htmlFor="profileLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Apellido(s)
                  </label>
                  <input
                    id="profileLastName"
                    type="text"
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>

                <div>
                  <p className="mb-1.5 block text-sm font-medium text-gray-900">Fecha de nacimiento</p>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={profileBirthDay}
                      onChange={(e) => setProfileBirthDay(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 ring-yellow-400"
                      aria-label="Día"
                    >
                      <option value="">Día</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      value={profileBirthMonth}
                      onChange={(e) => setProfileBirthMonth(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 ring-yellow-400"
                      aria-label="Mes"
                    >
                      <option value="">Mes</option>
                      {SPANISH_MONTHS.map((monthName, index) => {
                        const monthValue = String(index + 1).padStart(2, '0')
                        return (
                          <option key={monthValue} value={monthValue}>
                            {monthName}
                          </option>
                        )
                      })}
                    </select>
                    <select
                      value={profileBirthYear}
                      onChange={(e) => setProfileBirthYear(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 ring-yellow-400"
                      aria-label="Año"
                    >
                      <option value="">Año</option>
                      {Array.from(
                        { length: new Date().getFullYear() - 1926 + 1 },
                        (_, index) => String(new Date().getFullYear() - index)
                      ).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="profileEmail" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Email
                  </label>
                  {profileIsGoogle ? (
                    <div>
                      <div className="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-500">
                        {profileEmail}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600 shadow-sm"
                          aria-hidden
                        >
                          G
                        </span>
                        Vinculado con Google
                      </p>
                    </div>
                  ) : (
                    <input
                      id="profileEmail"
                      type="email"
                      autoComplete="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 focus:border-yellow-400 focus:ring-2"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="profilePhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Teléfono
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      ref={profileDialRef}
                      className={
                        profileCountryCode === 'otro'
                          ? 'relative w-20 max-w-20 shrink-0'
                          : 'relative w-28 max-w-28 shrink-0'
                      }
                    >
                      <button
                        type="button"
                        aria-expanded={profileDialOpen}
                        aria-haspopup="listbox"
                        onClick={() => setProfileDialOpen((open) => !open)}
                        className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none ring-yellow-400 focus:ring-2"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {dialCodeShortLabel(profileCountryCode)}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {profileDialOpen ? (
                        <ul
                          role="listbox"
                          className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('+34')
                                setProfileDialOpen(false)
                              }}
                            >
                              🇪🇸 +34 (España)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('+57')
                                setProfileDialOpen(false)
                              }}
                            >
                              🇨🇴 +57 (Colombia)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setProfileCountryCode('otro')
                                setProfileDialOpen(false)
                              }}
                            >
                              ✏️ Otro
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </div>
                    {profileCountryCode === 'otro' ? (
                      <input
                        type="text"
                        inputMode="tel"
                        value={profileCustomCode}
                        onChange={(e) => setProfileCustomCode(sanitizeDialPrefix(e.target.value))}
                        maxLength={5}
                        placeholder="+00"
                        aria-label="Prefijo internacional"
                        className="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm outline-none ring-yellow-400 focus:ring-2"
                      />
                    ) : null}
                    <input
                      id="profilePhone"
                      type="tel"
                      value={profilePhoneNumber}
                      onChange={(e) => setProfilePhoneNumber(e.target.value)}
                      placeholder="Ej. 612345678"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 focus:ring-2"
                    />
                  </div>
                </div>

                {!profileIsGoogle ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordSection((v) => !v)}
                      className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                    >
                      Cambiar contraseña
                    </button>
                    {showPasswordSection ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Nueva contraseña"
                          value={profileNewPassword}
                          onChange={(e) => setProfileNewPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none ring-yellow-400 focus:ring-2"
                        />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Confirmar contraseña"
                          value={profileConfirmPassword}
                          onChange={(e) => setProfileConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none ring-yellow-400 focus:ring-2"
                        />
                        <button
                          type="button"
                          disabled={profileSaving}
                          onClick={() => void handleUpdatePassword()}
                          className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold ${brand.buttonSecondary}`}
                        >
                          Actualizar contraseña
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {profileError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={profileSaving}
                  onClick={() => void handleProfileSave()}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {profileSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {profileSuccessToast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] flex max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-2">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Cambios guardados ✓
          </div>
          {profilePhoneNotice ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 shadow-lg">
              Tu nuevo número aparecerá en los próximos eventos que crees.
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
