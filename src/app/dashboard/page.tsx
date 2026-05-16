'use client'

// Dashboard home — profile, children, events summary, invited events, favorites
// Route: /dashboard

import AppNav from '@/components/AppNav'
import { ChildrenSection, type DashboardChildRow } from '@/components/ChildrenSection'
import { brand } from '@/lib/brand'
import { CalendarDays, Map as MapIcon, X } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  phone: string | null
}

type FamilyMemberPartner = {
  id: string
  full_name: string
  last_name: string | null
  phone: string | null
}

const partnerAvatarColors = [
  'bg-yellow-100 text-yellow-700',
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
]

const partnerInputClassName = `w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${brand.inputFocus}`

function getPartnerInitials(name: string, lastName: string | null) {
  const first = name.trim()[0]?.toUpperCase() || ''
  const last = (lastName ?? '').trim()[0]?.toUpperCase() || ''
  return first + last || '?'
}

function sanitizeDialPrefix(raw: string): string {
  const digitsPlus = raw.replace(/[^\d+]/g, '')
  if (digitsPlus.length === 0) return ''
  let body = digitsPlus.startsWith('+') ? digitsPlus.slice(1) : digitsPlus
  body = body.replace(/\+/g, '')
  return ('+' + body).slice(0, 5)
}

function splitDialPhone(full: string): {
  countryCode: '+34' | '+57' | 'otro'
  customCode: string
  number: string
} {
  const trimmed = full.trim()
  if (!trimmed) return { countryCode: '+34', customCode: '', number: '' }
  if (trimmed.startsWith('+57')) {
    return { countryCode: '+57', customCode: '', number: trimmed.slice(3) }
  }
  if (trimmed.startsWith('+34')) {
    return { countryCode: '+34', customCode: '', number: trimmed.slice(3) }
  }
  const match = trimmed.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1] && match[2] !== undefined) {
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

function buildFullPhone(countryCode: string, customDialCode: string, phoneNumber: string): string {
  const dial = resolveDialCode(countryCode, customDialCode)
  const trimmedPhone = phoneNumber.replace(/\s/g, '')
  return trimmedPhone ? `${dial}${trimmedPhone}` : ''
}

function partnerDisplayLabel(partner: FamilyMemberPartner) {
  const first = partner.full_name.trim()
  const last = (partner.last_name ?? '').trim()
  if (!last) return first
  return `${first} ${last}`.trim()
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

function isValidUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function pickAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null
  return trimmed
}

function parentAvatarFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    pickAvatarUrl(meta?.picture) ??
    pickAvatarUrl(meta?.avatar_url) ??
    pickAvatarUrl(meta?.photoURL)
  if (fromMeta) return fromMeta

  for (const identity of user.identities ?? []) {
    const data = identity.identity_data as Record<string, unknown> | undefined
    const fromIdentity =
      pickAvatarUrl(data?.picture) ??
      pickAvatarUrl(data?.avatar_url) ??
      pickAvatarUrl(data?.photoURL)
    if (fromIdentity) return fromIdentity
  }

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
  const [avatarError, setAvatarError] = useState(false)
  const [partner, setPartner] = useState<FamilyMemberPartner | null>(null)
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [partnerFirstName, setPartnerFirstName] = useState('')
  const [partnerLastName, setPartnerLastName] = useState('')
  const [partnerCountryCode, setPartnerCountryCode] = useState<string>('+34')
  const [partnerCustomDialCode, setPartnerCustomDialCode] = useState('')
  const [partnerPhoneNumber, setPartnerPhoneNumber] = useState('')
  const [partnerDialOpen, setPartnerDialOpen] = useState(false)
  const [partnerSaving, setPartnerSaving] = useState(false)
  const [partnerModalError, setPartnerModalError] = useState<string | null>(null)
  const [partnerSaveSuccess, setPartnerSaveSuccess] = useState(false)
  const partnerDialRef = useRef<HTMLDivElement>(null)

  const todayStr = useMemo(() => todayLocalIso(), [])

  const loadPartner = useCallback(
    async (uid: string) => {
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select('id, full_name, last_name, phone')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })

      const first = (familyMembers?.[0] as FamilyMemberPartner | undefined) ?? null
      setPartner(first)
      return first
    },
    [supabase]
  )

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
          setPartner(null)
          setLoading(false)
        }
        return
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle()

      const phone =
        typeof userProfile?.phone === 'string' && userProfile.phone.trim()
          ? userProfile.phone.trim()
          : null

      if (isMounted) {
        setUserId(user.id)
        setUserFirstName(userFirstDisplayName(user))
        setParentProfile({
          email: user.email ?? '',
          fullName: parentFullNameFromUser(user),
          avatarUrl: parentAvatarFromUser(user),
          phone,
        })
      }

      const [eventsRes, childrenRes, familyRes] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, public_slug, title, child_name, event_date, start_time, location_name, location_address, invitation_theme, invitation_image_url'
          )
          .eq('user_id', user.id),
        supabase
          .from('children')
          .select('id, name, last_name, birth_date, avatar_url, short_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('family_members')
          .select('id, full_name, last_name, phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      if (!isMounted) return

      const familyMembers = familyRes.data as FamilyMemberPartner[] | null
      setPartner(familyMembers?.[0] ?? null)

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
    if (!partnerDialOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (partnerDialRef.current?.contains(event.target as Node)) return
      setPartnerDialOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [partnerDialOpen])

  useEffect(() => {
    if (!showAddPartnerModal) return
    setPartnerModalError(null)
    if (partner) {
      setPartnerFirstName(partner.full_name)
      setPartnerLastName(partner.last_name ?? '')
      const phoneParts = splitDialPhone(partner.phone ?? '')
      setPartnerCountryCode(phoneParts.countryCode)
      setPartnerCustomDialCode(phoneParts.customCode)
      setPartnerPhoneNumber(phoneParts.number)
    } else {
      setPartnerFirstName('')
      setPartnerLastName('')
      setPartnerCountryCode('+34')
      setPartnerCustomDialCode('')
      setPartnerPhoneNumber('')
    }
  }, [showAddPartnerModal, partner])

  const handlePartnerSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPartnerModalError(null)
    setPartnerSaving(true)

    const trimmedName = partnerFirstName.trim()
    const trimmedLastName = partnerLastName.trim()
    if (!trimmedName) {
      setPartnerModalError('El nombre es obligatorio.')
      setPartnerSaving(false)
      return
    }

    if (!userId) {
      setPartnerModalError('No se pudo obtener tu sesión.')
      setPartnerSaving(false)
      return
    }

    const dial = resolveDialCode(partnerCountryCode, partnerCustomDialCode)
    if (partnerCountryCode === 'otro' && dial.length <= 1 && partnerPhoneNumber.trim()) {
      setPartnerModalError('Indica un prefijo internacional válido.')
      setPartnerSaving(false)
      return
    }

    const fullPhone = buildFullPhone(partnerCountryCode, partnerCustomDialCode, partnerPhoneNumber)

    if (partner) {
      const { error: updateError } = await supabase
        .from('family_members')
        .update({
          full_name: trimmedName,
          last_name: trimmedLastName || null,
          phone: fullPhone || null,
        })
        .eq('id', partner.id)

      if (updateError) {
        setPartnerModalError(updateError.message)
        setPartnerSaving(false)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('family_members').insert({
        user_id: userId,
        full_name: trimmedName,
        last_name: trimmedLastName || null,
        phone: fullPhone || null,
      })

      if (insertError) {
        setPartnerModalError(insertError.message)
        setPartnerSaving(false)
        return
      }
    }

    await loadPartner(userId)
    setShowAddPartnerModal(false)
    setPartnerSaving(false)
    setPartnerSaveSuccess(true)
    window.setTimeout(() => setPartnerSaveSuccess(false), 2000)
  }

  const greetingTitle = userFirstName ? `Hola ${userFirstName} 👋` : 'Hola 👋'

  const profileInitials = parentProfile
    ? initialsFromDisplay(parentProfile.fullName, parentProfile.email)
    : '?'

  const avatarUrl = parentProfile?.avatarUrl ?? null
  const showParentAvatar = avatarUrl != null && isValidUrl(avatarUrl) && !avatarError

  useEffect(() => {
    setAvatarError(false)
  }, [avatarUrl])

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
            <div className="flex min-h-[5.625rem] flex-row items-center gap-3 rounded-2xl bg-white p-3 shadow-sm sm:gap-4">
              {showParentAvatar ? (
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${brand.accentBg}`}
                  aria-hidden
                >
                  {profileInitials.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-gray-900">
                  {parentProfile.fullName ?? 'Tu cuenta'}
                </p>
                {parentProfile.phone ? (
                  <p className="truncate text-sm text-gray-500">{parentProfile.phone}</p>
                ) : null}
                <p className="truncate text-sm text-gray-400">{parentProfile.email}</p>
                <Link
                  href="/dashboard/perfil"
                  className={`mt-1 inline-block text-xs font-medium underline ${brand.accentText} ${brand.textBrandHover}`}
                >
                  Editar perfil
                </Link>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowAddPartnerModal(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setShowAddPartnerModal(true)
                }
              }}
              className={`flex min-h-[5.625rem] cursor-pointer flex-row items-center gap-3 rounded-2xl bg-white p-3 shadow-sm sm:gap-4 ${
                partner ? 'border border-gray-100' : 'border border-dashed border-gray-200'
              }`}
            >
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-base font-semibold ${
                  partner ? partnerAvatarColors[0] : 'border-2 bg-gray-50 text-gray-400'
                }`}
                aria-hidden
              >
                {partner ? getPartnerInitials(partner.full_name, partner.last_name) : '+'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                {partner ? (
                  <>
                    <p className="truncate text-base font-semibold text-gray-900">
                      {partnerDisplayLabel(partner)}
                    </p>
                    {partner.phone ? (
                      <p className="truncate text-sm text-gray-500">{partner.phone}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setShowAddPartnerModal(true)
                      }}
                      className={`mt-1 inline-block text-xs font-medium underline ${brand.accentText} ${brand.textBrandHover}`}
                    >
                      Editar
                    </button>
                  </>
                ) : (
                  <p className="text-xs font-medium text-gray-400">Añadir pareja</p>
                )}
              </div>
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
              📍 Lugares
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : events.length === 0 || distinctLocations.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">
                📍 Los lugares de tus eventos aparecerán aquí automáticamente.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {distinctLocations.map(({ name, address }) => (
                  <a
                    key={name}
                    href={googleMapsSearchUrl(name, address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full flex-row items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition hover:border-yellow-200 hover:bg-yellow-50/50"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100"
                      aria-hidden
                    >
                      <MapIcon className="h-4 w-4 text-gray-400" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700">{name}</p>
                      {address ? (
                        <p className="mt-0.5 truncate text-xs text-gray-400" title={address}>
                          {address}
                        </p>
                      ) : null}
                    </div>
                    <span className="sr-only">Abrir en Google Maps</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {partnerSaveSuccess ? (
        <p
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          Pareja guardada ✓
        </p>
      ) : null}

      {showAddPartnerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-modal-title"
          >
            <button
              type="button"
              onClick={() => setShowAddPartnerModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <h2 id="partner-modal-title" className="pr-8 text-lg font-semibold text-gray-900">
              {partner ? 'Editar pareja' : 'Añadir pareja'}
            </h2>
            <form onSubmit={handlePartnerSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="partnerFirstName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Nombre
                </label>
                <input
                  id="partnerFirstName"
                  type="text"
                  autoComplete="given-name"
                  value={partnerFirstName}
                  onChange={(event) => setPartnerFirstName(event.target.value)}
                  required
                  className={partnerInputClassName}
                  placeholder="Ej. Carlos"
                />
              </div>
              <div>
                <label htmlFor="partnerLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Apellido(s)
                </label>
                <input
                  id="partnerLastName"
                  type="text"
                  autoComplete="family-name"
                  value={partnerLastName}
                  onChange={(event) => setPartnerLastName(event.target.value)}
                  className={partnerInputClassName}
                  placeholder="Ej. López"
                />
              </div>
              <div>
                <label htmlFor="partnerPhoneNumber" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Teléfono
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    ref={partnerDialRef}
                    className={
                      partnerCountryCode === 'otro'
                        ? 'relative w-20 max-w-20 shrink-0'
                        : 'relative w-28 max-w-28 shrink-0'
                    }
                  >
                    <button
                      type="button"
                      aria-expanded={partnerDialOpen}
                      aria-haspopup="listbox"
                      onClick={() => setPartnerDialOpen((open) => !open)}
                      className="flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {dialCodeShortLabel(partnerCountryCode)}
                      </span>
                      <span className="shrink-0 text-[10px] leading-none text-gray-500" aria-hidden>
                        ▾
                      </span>
                    </button>
                    {partnerDialOpen ? (
                      <ul
                        role="listbox"
                        className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === '+34'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('+34')
                              setPartnerDialOpen(false)
                            }}
                          >
                            🇪🇸 +34 (España)
                          </button>
                        </li>
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === '+57'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('+57')
                              setPartnerDialOpen(false)
                            }}
                          >
                            🇨🇴 +57 (Colombia)
                          </button>
                        </li>
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={partnerCountryCode === 'otro'}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                            onClick={() => {
                              setPartnerCountryCode('otro')
                              setPartnerDialOpen(false)
                            }}
                          >
                            ✏️ Otro
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  {partnerCountryCode === 'otro' ? (
                    <input
                      type="text"
                      inputMode="tel"
                      autoComplete="tel-country-code"
                      value={partnerCustomDialCode}
                      onChange={(event) =>
                        setPartnerCustomDialCode(sanitizeDialPrefix(event.target.value))
                      }
                      maxLength={5}
                      placeholder="+00"
                      aria-label="Prefijo internacional"
                      className="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                    />
                  ) : null}
                  <input
                    id="partnerPhoneNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={partnerPhoneNumber}
                    onChange={(event) => setPartnerPhoneNumber(event.target.value)}
                    placeholder="Ej. 612345678"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>
              </div>

              {partnerModalError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {partnerModalError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={partnerSaving}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${brand.buttonPrimary}`}
              >
                {partnerSaving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(false)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonOutline}`}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
