'use client'

// Event control center — manages a single event and its RSVPs
// Route: /dashboard/eventos/[slug]
// Do not confuse with the Eventos page at /dashboard/eventos

import AppNav from '@/components/AppNav'
import Link from 'next/link'
import { Contact, Copy, LayoutGrid, MessageCircle, Pencil, Share2, Table2, X } from 'lucide-react'
import OrganizerAddGuestModal from '@/components/dashboard/OrganizerAddGuestModal'
import OrganizerRsvpEditModal from '@/components/dashboard/OrganizerRsvpEditModal'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { subDays } from 'date-fns'
import { brand } from '@/lib/brand'
import { EVENT_STATUS_ACTIVE, EVENT_STATUS_DRAFT } from '@/lib/eventLifecycle'
import { formatSpanishDateMedium, formatSpanishFullDate, parseIsoDateParts } from '@/lib/dates'
import { createClient } from '@/lib/supabase/client'
import ShareButton from '@/components/ShareButton'
import { ConfettiBurst } from '@/components/ConfettiBurst'
import { PublishedSuccessModal } from '@/components/PublishedSuccessModal'
import {
  hasMeaningfulRsvpAllergyNotes,
  normalizeRsvpAllergyNotesForStorage,
} from '@/lib/rsvpAllergyNotes'
import { verifyCheckoutReturnWithRetry } from '@/lib/stripe/verifyCheckoutReturn'

function localTodayIsoDate() {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type EventDetails = {
  id: string
  user_id: string
  public_slug: string
  status?: string | null
  title: string
  child_name: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  enable_food_options: boolean | null
  gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool' | null
  bizum_phone: string | null
  organizer_notes: string | null
  rsvp_deadline_days: number | null
  invitation_theme: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | null
  invitation_image_url: string | null
  invitation_image_fit: 'contain' | 'cover' | null
  invitation_image_position: string | null
  invitation_image_zoom: number | null
}

type RsvpItem = {
  id: string
  child_name: string
  guest_parent_name: string
  guest_parent_phone: string | null
  guest_parent_email: string | null
  attendance_status: 'confirmed' | 'declined' | 'maybe' | null
  food_preference: string | null
  allergy_notes: string | null
  extra_notes: string | null
  is_family: boolean | null
}

function getFamilyRsvpBadge(
  rsvp: RsvpItem,
  eventChildName: string
): { label: string; emoji: string } | null {
  if (!rsvp.is_family) return null
  if (rsvp.child_name.trim().toLowerCase() === eventChildName.trim().toLowerCase()) {
    return { emoji: '🎂', label: 'Cumpleañero/a' }
  }
  return { emoji: '👨‍👩‍👧', label: 'Familia' }
}

function formatTimeValue(time: string) {
  return time.slice(0, 5)
}

function formatRsvpConfirmacionesDate(isoDate: string, daysBefore: number) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const eventDay = new Date(parts.year, parts.month - 1, parts.day)
  const deadline = subDays(eventDay, daysBefore)
  const iso = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`
  return formatSpanishDateMedium(iso)
}

function formatDashboardGiftLine(event: {
  gift_option: EventDetails['gift_option']
  bizum_phone: string | null
}): string | null {
  const g = event.gift_option
  if (g == null) return null
  if (g === 'sin_regalo') return '🚫 Sin regalo'
  if (g === 'regalo_libre') return '🎁 Regalo libre'
  if (g === 'bizum_pool') {
    const phone = (event.bizum_phone ?? '').trim()
    if (!phone) return '🎁 Hucha al móvil'
    if (phone.startsWith('+34')) {
      return `🎁 Hucha al móvil ${phone.slice(3)} (Bizum)`
    }
    if (phone.startsWith('+52')) {
      return `🎁 Nequi al celular ${phone.slice(3)}`
    }
    return `🎁 Hucha al móvil ${phone}`
  }
  return null
}

const EXPORT_MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

function formatExportEventDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const monthName = EXPORT_MONTH_NAMES[(m ?? 1) - 1] ?? ''
  return `${d} ${monthName} ${y}`
}

const MIPARTY_EXPORT_FOOTER =
  '🎉 _Este mensaje ha sido generado gracias a miparty.net — Más eventos, menos caos_'

function appendMipartyExportFooter(text: string): string {
  return `${text}\n\n${MIPARTY_EXPORT_FOOTER}`
}

function buildEventExportHeader(ev: EventDetails): string {
  const lines = [ev.title]
  const datePart = formatExportEventDate(ev.event_date)
  const start = formatTimeValue(ev.start_time)
  const end = ev.pickup_time ? formatTimeValue(ev.pickup_time) : null
  lines.push(
    end ? `${datePart} · De: ${start} Hasta: ${end}` : `${datePart} · A las: ${start}`
  )

  const locationName = ev.location_name?.trim() ?? ''
  const locationAddress = ev.location_address?.trim() ?? ''
  const mapsUrl = ev.google_maps_url?.trim() ?? ''
  const locationText = [locationName, locationAddress].filter(Boolean).join(', ')
  if (locationText || mapsUrl) {
    lines.push(locationText && mapsUrl ? `${locationText} — ${mapsUrl}` : locationText || mapsUrl)
  }

  return lines.join('\n')
}

function formatConfirmedAttendeeExportLine(rsvp: RsvpItem, index: number): string {
  const name = rsvp.child_name.trim()
  const food = (rsvp.food_preference ?? '').trim()
  const allergy = normalizeRsvpAllergyNotesForStorage(rsvp.allergy_notes)

  if (food && allergy) {
    return `${index + 1}. ${name} | ${food} (${allergy})`
  }
  if (food) {
    return `${index + 1}. ${name} | ${food}`
  }
  if (allergy) {
    return `${index + 1}. ${name} (${allergy})`
  }
  return `${index + 1}. ${name}`
}

type AllergyExportRow = { childName: string; foodSelected: string; note: string }

function buildComidaYAlergiasExportText(
  ev: EventDetails,
  counts: { label: string; count: number }[],
  allergies: AllergyExportRow[]
) {
  const parts: string[] = [buildEventExportHeader(ev)]
  if (ev.enable_food_options && counts.length > 0) {
    parts.push('', '🍽️ RESUMEN DE COMIDA', ...counts.map((item) => `${item.label}: ${item.count}`))
  }
  if (allergies.length > 0) {
    parts.push(
      '',
      '⚠️ ALERGIAS E INTOLERANCIAS',
      ...allergies.map((a, i) => {
        const foodCol = a.foodSelected ? a.foodSelected : 'Sin comida seleccionada'
        return `${i + 1}. ${a.childName} | ${foodCol} | ${a.note}`
      })
    )
  }
  return appendMipartyExportFooter(parts.join('\n'))
}

function buildConfirmedAttendeesExportText(ev: EventDetails, rsvpList: RsvpItem[]) {
  const confirmed = rsvpList
    .filter((r) => r.attendance_status === 'confirmed')
    .sort(compareRsvpsForDisplay)
  const rows = confirmed.map((rsvp, index) => formatConfirmedAttendeeExportLine(rsvp, index))
  return appendMipartyExportFooter(
    [buildEventExportHeader(ev), '', `✅ CONFIRMADOS (${confirmed.length})`, ...rows].join('\n')
  )
}

function compareRsvpsForDisplay(a: RsvpItem, b: RsvpItem) {
  if (a.is_family && !b.is_family) return -1
  if (!a.is_family && b.is_family) return 1
  return a.child_name.trim().localeCompare(b.child_name.trim(), 'es', { sensitivity: 'base' })
}

function rsvpStatusMeta(status: RsvpItem['attendance_status']) {
  if (status === 'confirmed') {
    return { label: 'Confirmado', badge: 'bg-green-100 text-green-700 border-green-200' }
  }
  if (status === 'declined') {
    return { label: 'No puede', badge: 'bg-red-100 text-red-700 border-red-200' }
  }
  if (status === 'maybe') {
    return { label: 'Aún no sabe', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  return { label: 'Pendiente', badge: 'bg-gray-100 text-gray-600 border-gray-200' }
}

type GuestContactTarget = {
  childName: string
  parentName: string
  phone: string
}

function digitsForWhatsApp(phone: string) {
  return phone.replace(/\D/g, '')
}

function escapeVCardValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

function downloadGuestContactVCard(parentName: string, phone: string) {
  const tel = digitsForWhatsApp(phone)
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(parentName)}`,
    ...(tel ? [`TEL;TYPE=CELL:${tel}`] : []),
    'END:VCARD',
  ].join('\n')
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${parentName.replace(/\s+/g, '_') || 'contacto'}.vcf`
  anchor.click()
  URL.revokeObjectURL(url)
}

function openGuestWhatsApp(phone: string, childName: string) {
  const digits = digitsForWhatsApp(phone)
  if (digits.length < 8) return false
  const text = encodeURIComponent(
    `Hola, soy el organizador del cumpleaños de ${childName}. `
  )
  window.location.assign(`https://wa.me/${digits}?text=${text}`)
  return true
}

function RsvpEditIconButton({
  onClick,
  className = '',
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${className}`}
      aria-label="Editar invitado"
    >
      <Pencil className="h-4 w-4" aria-hidden />
    </button>
  )
}

function RsvpContactIconButton({
  rsvp,
  onOpen,
  className = '',
}: {
  rsvp: RsvpItem
  onOpen: (target: GuestContactTarget) => void
  className?: string
}) {
  const parentName = (rsvp.guest_parent_name ?? '').trim()
  const phone = (rsvp.guest_parent_phone ?? '').trim()
  if (!parentName && !phone) {
    return <span className="text-gray-300">—</span>
  }
  return (
    <button
      type="button"
      onClick={() =>
        onOpen({
          childName: rsvp.child_name.trim(),
          parentName: parentName || '—',
          phone,
        })
      }
      className={`inline-flex rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 ${className}`}
      aria-label={`Contacto: ${parentName || rsvp.child_name}`}
    >
      <Contact className="h-4 w-4" aria-hidden />
    </button>
  )
}

function GuestContactModal({
  contact,
  onClose,
  onToast,
}: {
  contact: GuestContactTarget
  onClose: () => void
  onToast: (message: string) => void
}) {
  const phoneDigits = digitsForWhatsApp(contact.phone)
  const canWhatsApp = phoneDigits.length >= 8
  const canSave = contact.parentName !== '—' || contact.phone.trim() !== ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-contact-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-lg leading-none text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <h2 id="guest-contact-modal-title" className="pr-8 text-lg font-bold text-gray-900">
          Contacto del invitado
        </h2>
        <p className="mt-1 text-sm text-gray-500">Invitado/a: {contact.childName}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Adulto responsable</dt>
            <dd className="font-medium text-gray-900">{contact.parentName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Teléfono</dt>
            <dd className="font-medium text-gray-900">
              {contact.phone.trim() ? contact.phone : '—'}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return
              downloadGuestContactVCard(contact.parentName, contact.phone)
              onToast('Contacto listo para guardar')
              onClose()
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar como contacto
          </button>
          <button
            type="button"
            disabled={!canWhatsApp}
            onClick={() => {
              if (!openGuestWhatsApp(contact.phone, contact.childName)) {
                onToast('Añade un teléfono válido para enviar WhatsApp')
                return
              }
              onClose()
            }}
            className="w-full rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe57] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar mensaje por WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EventControlCenterPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug =
    typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? (params.slug[0] ?? '') : ''

  const [event, setEvent] = useState<EventDetails | null>(null)
  const [foodOptionLabels, setFoodOptionLabels] = useState<string[]>([])
  const [rsvps, setRsvps] = useState<RsvpItem[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const copyInviteLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [guestContactModal, setGuestContactModal] = useState<GuestContactTarget | null>(null)
  const [editingRsvp, setEditingRsvp] = useState<RsvpItem | null>(null)
  const [showAddGuestModal, setShowAddGuestModal] = useState(false)
  const [confirmingCheckoutReturn, setConfirmingCheckoutReturn] = useState(false)
  const [checkoutVerifyError, setCheckoutVerifyError] = useState<string | null>(null)
  const [showPublishedSuccess, setShowPublishedSuccess] = useState(false)
  const [showPublishConfetti, setShowPublishConfetti] = useState(false)
  const inviteShareSectionRef = useRef<HTMLDivElement>(null)
  const publishCelebrationStartedRef = useRef(false)

  const toggleFilter = (status: string) => {
    setActiveFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (window.innerWidth >= 768) {
      setViewMode('table')
    } else {
      setViewMode('cards')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyInviteLinkTimeoutRef.current != null) {
        clearTimeout(copyInviteLinkTimeoutRef.current)
      }
      if (toastTimeoutRef.current != null) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    if (checkout !== 'success' || !sessionId || !slug) return

    let cancelled = false
    const confirmPaymentReturn = async () => {
      setConfirmingCheckoutReturn(true)
      setCheckoutVerifyError(null)

      const result = await verifyCheckoutReturnWithRetry(sessionId)
      if (cancelled) return

      setConfirmingCheckoutReturn(false)

      if (result.status === 401) {
        setCheckoutVerifyError('Inicia sesión de nuevo para confirmar el pago.')
        router.replace(`/dashboard/eventos/${slug}`)
        return
      }

      if (!result.ok || !result.published || !result.slug) {
        setCheckoutVerifyError(
          result.error ??
            'El pago se recibió, pero el evento aún no está publicado. Espera unos segundos y recarga la página.'
        )
        router.replace(`/dashboard/eventos/${slug}`)
        return
      }

      router.replace(`/dashboard/eventos/${result.slug}?published=paid`)
    }

    void confirmPaymentReturn()
    return () => {
      cancelled = true
    }
  }, [searchParams, router, slug])

  useEffect(() => {
    const published = searchParams.get('published')
    if (published !== 'paid' && published !== 'free') return
    if (loading || !event) return
    if (publishCelebrationStartedRef.current) return

    publishCelebrationStartedRef.current = true
    setShowPublishConfetti(true)
    setShowPublishedSuccess(true)
    window.setTimeout(() => setShowPublishConfetti(false), 3200)
  }, [searchParams, loading, event])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadError(false)
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (!cancelled) {
          setLoading(false)
        }
        router.replace('/login')
        return
      }

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select(
          'id, user_id, public_slug, status, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, enable_food_options, organizer_notes, rsvp_deadline_days, invitation_theme, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom'
        )
        .eq('public_slug', slug)
        .eq('user_id', user.id)
        .maybeSingle<EventDetails>()

      if (cancelled) {
        return
      }

      if (eventError || !eventRow) {
        if (!cancelled) {
          setLoadError(true)
          setLoading(false)
        }
        return
      }

      if (eventRow.status === EVENT_STATUS_DRAFT) {
        const awaitingCheckoutConfirm =
          searchParams.get('checkout') === 'success' && Boolean(searchParams.get('session_id'))

        if (awaitingCheckoutConfirm) {
          if (!cancelled) {
            setLoading(false)
          }
          return
        }

        const { data: paidRow } = await supabase
          .from('event_payments')
          .select('id')
          .eq('event_id', eventRow.id)
          .eq('status', 'paid')
          .maybeSingle()

        if (paidRow) {
          await supabase
            .from('events')
            .update({ status: EVENT_STATUS_ACTIVE })
            .eq('id', eventRow.id)
            .eq('user_id', user.id)
          router.replace(`/dashboard/eventos/${slug}?published=paid`)
          return
        }

        router.replace(`/dashboard/eventos/nuevo?draftId=${eventRow.id}`)
        return
      }

      const { data: rsvpRows } = await supabase
        .from('rsvps')
        .select(
          'id, child_name, guest_parent_name, guest_parent_phone, guest_parent_email, attendance_status, food_preference, allergy_notes, extra_notes, is_family'
        )
        .eq('event_id', eventRow.id)

      let labels: string[] = []
      if (eventRow.enable_food_options) {
        const { data: foodRows } = await supabase
          .from('event_food_options')
          .select('label')
          .eq('event_id', eventRow.id)
        labels = (foodRows ?? [])
          .map((row: { label: string }) => row.label)
          .filter((label: string) => String(label).trim() !== '')
      }

      if (cancelled) {
        return
      }

      setEvent(eventRow)
      setFoodOptionLabels(labels)
      setRsvps((rsvpRows ?? []) as RsvpItem[])
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug, router, searchParams])

  const confirmedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'confirmed').length
  const declinedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'declined').length
  const pendingCount = 0

  const todayIso = useMemo(() => localTodayIsoDate(), [])

  const isEventPast = useMemo(() => {
    if (!event?.event_date) {
      return false
    }
    return event.event_date < todayIso
  }, [event?.event_date, todayIso])

  const isEventUpcoming = useMemo(() => {
    if (!event?.event_date) {
      return true
    }
    const parts = event.event_date.split('-').map((v) => Number.parseInt(v, 10))
    const y = parts[0] ?? 0
    const mo = parts[1] ?? 1
    const d = parts[2] ?? 1
    const eventDay = new Date(y, mo - 1, d)
    const t = new Date()
    const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate())
    return eventDay >= todayStart
  }, [event?.event_date])

  const filteredRsvps = useMemo(() => {
    const list =
      activeFilters.length === 0
        ? rsvps
        : rsvps.filter((r) => activeFilters.includes(r.attendance_status ?? 'pending'))
    return [...list].sort(compareRsvpsForDisplay)
  }, [rsvps, activeFilters])

  const showDemoLucía = activeFilters.length === 0 || activeFilters.includes('confirmed')
  const showDemoEmma = activeFilters.length === 0 || activeFilters.includes('declined')
  const anyDemoRowVisible = showDemoLucía || showDemoEmma

  const foodPreferenceCounts = useMemo(() => {
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
  }, [rsvps])

  const allergyEntries = useMemo(
    () =>
      [...rsvps]
        .sort(compareRsvpsForDisplay)
        .filter((rsvp) => hasMeaningfulRsvpAllergyNotes(rsvp.allergy_notes))
        .map((rsvp) => ({
          childName: rsvp.child_name.trim(),
          foodSelected: (rsvp.food_preference ?? '').trim(),
          note: normalizeRsvpAllergyNotesForStorage(rsvp.allergy_notes) ?? '',
        })),
    [rsvps]
  )

  const confirmacionesLine = useMemo(() => {
    if (!event) return ''
    const d = event.rsvp_deadline_days
    if (d != null && d > 0 && Number.isFinite(d)) {
      return `Confirmaciones hasta el ${formatRsvpConfirmacionesDate(event.event_date, d)}`
    }
    return 'Confirmaciones hasta el día del evento'
  }, [event])

  const showFoodColumn = Boolean(event?.enable_food_options && foodOptionLabels.length > 0)
  const rsvpTableColCount = (showFoodColumn ? 6 : 5) + 1

  const dashboardGiftLine = event ? formatDashboardGiftLine(event) : null
  const hasLocationDetails =
    event &&
    ((event.location_name != null && String(event.location_name).trim() !== '') ||
      (event.location_address != null && String(event.location_address).trim() !== '') ||
      (event.google_maps_url != null && String(event.google_maps_url).trim() !== ''))

  const themeKey = event?.invitation_theme ?? 'yellow'
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
  const accentPillSoftBgMap: Record<string, string> = {
    yellow: 'bg-yellow-100',
    pink: 'bg-pink-100',
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
  }
  const pageBg = pageBgMap[themeKey] ?? pageBgMap.yellow
  const primaryButtonClass = buttonMap[themeKey] ?? buttonMap.yellow
  const accentBorderClass = accentBorderMap[themeKey] ?? accentBorderMap.yellow
  const accentSoftBgClass = accentSoftBgMap[themeKey] ?? accentSoftBgMap.yellow
  const accentTextClass = accentTextMap[themeKey] ?? accentTextMap.yellow
  const accentPillSoftBgClass = accentPillSoftBgMap[themeKey] ?? accentPillSoftBgMap.yellow

  const statRingActiveMap: Record<string, string> = {
    yellow: 'ring-yellow-400',
    pink: 'ring-pink-400',
    blue: 'ring-blue-400',
    green: 'ring-green-400',
    purple: 'ring-purple-400',
  }
  const statRingActiveClass = statRingActiveMap[themeKey] ?? statRingActiveMap.yellow

  const viewIconActiveClass =
    (
      {
        yellow: 'bg-yellow-400 text-white',
        pink: 'bg-pink-400 text-white',
        blue: 'bg-blue-400 text-white',
        green: 'bg-green-400 text-white',
        purple: 'bg-purple-400 text-white',
      } as Record<string, string>
    )[themeKey] ?? 'bg-yellow-400 text-white'
  const viewIconInactiveClass = 'bg-gray-100 text-gray-500'

  const exportIconButtonClass =
    'rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600'

  const showToast = (message: string) => {
    if (toastTimeoutRef.current != null) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToastMessage(message)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
      toastTimeoutRef.current = null
    }, 2000)
  }

  const dismissPublishedSuccess = () => {
    setShowPublishedSuccess(false)
    if (slug) {
      router.replace(`/dashboard/eventos/${slug}`)
    }
  }

  const shareEventInvitation = async () => {
    if (!event) return
    const url = `https://miparty.net/e/${event.public_slug}`
    const shareData = {
      title: event.title,
      text: `¡Hola! Te comparto la invitación al cumple de ${event.child_name} 🎉`,
      url,
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(url)
        showToast('Enlace copiado ✨')
      }
    } catch {
      /* share cancelled or unavailable */
    }
  }

  const handlePublishedShareClick = () => {
    dismissPublishedSuccess()
    inviteShareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    void shareEventInvitation()
  }

  const shareOrCopyExport = async (text: string, title: string, copyToast: string) => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text })
        return
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError') {
          return
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast(copyToast)
    } catch {
      /* ignore */
    }
  }

  const copyComidaYAlergias = async () => {
    if (!event) {
      return
    }
    const text = buildComidaYAlergiasExportText(event, foodPreferenceCounts, allergyEntries)
    try {
      await navigator.clipboard.writeText(text)
      showToast('Resumen de comida copiado ✨')
    } catch {
      /* ignore */
    }
  }

  const shareComidaYAlergias = async () => {
    if (!event) {
      return
    }
    const text = buildComidaYAlergiasExportText(event, foodPreferenceCounts, allergyEntries)
    await shareOrCopyExport(text, event.title, 'Resumen de comida copiado ✨')
  }

  const copyConfirmedAttendees = async () => {
    if (!event) {
      return
    }
    const text = buildConfirmedAttendeesExportText(event, rsvps)
    try {
      await navigator.clipboard.writeText(text)
      showToast('Invitados confirmados copiados ✨')
    } catch {
      /* ignore */
    }
  }

  const shareConfirmedAttendees = async () => {
    if (!event) {
      return
    }
    const text = buildConfirmedAttendeesExportText(event, rsvps)
    await shareOrCopyExport(text, event.title, 'Invitados confirmados copiados ✨')
  }

  const responsesSectionHeader = (
    <div className="mt-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-gray-900">Respuestas</h2>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Vista de tarjetas"
          onClick={() => setViewMode('cards')}
          className={`rounded-lg p-1.5 transition ${viewMode === 'cards' ? viewIconActiveClass : viewIconInactiveClass}`}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Vista de tabla"
          onClick={() => setViewMode('table')}
          className={`rounded-lg p-1.5 transition ${viewMode === 'table' ? viewIconActiveClass : viewIconInactiveClass}`}
        >
          <Table2 className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Copiar confirmados"
          title="Copiar confirmados"
          onClick={() => void copyConfirmedAttendees()}
          className={exportIconButtonClass}
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Compartir confirmados"
          title="Compartir confirmados"
          onClick={() => void shareConfirmedAttendees()}
          className={exportIconButtonClass}
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )

  if (loading && !confirmingCheckoutReturn) return null

  if (confirmingCheckoutReturn) {
    return (
      <main className={`min-h-screen ${brand.pageBg} px-4 py-8`}>
        <AppNav backHref="/dashboard" backLabel="⬅️ Mi panel" />
        <p className="mt-8 text-center text-sm text-gray-600">
          Confirmando tu pago… En unos segundos verás tu panel del evento.
        </p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className={`min-h-screen ${brand.pageBg} px-4 py-8`}>
        <p className="text-center text-sm text-gray-600">No encontramos este evento.</p>
      </main>
    )
  }

  if (!event) {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
        <p className="text-center text-sm text-gray-600">Cargando...</p>
      </main>
    )
  }

  return (
    <main className={`min-h-screen bg-gradient-to-b ${pageBg}`}>
      <PublishedSuccessModal
        open={showPublishedSuccess}
        variant={searchParams.get('published') === 'free' ? 'free' : 'paid'}
        onClose={dismissPublishedSuccess}
        onShareInvitation={handlePublishedShareClick}
      />
      <ConfettiBurst active={showPublishConfetti} />
      <AppNav backHref="/dashboard" backLabel="⬅️ Mi panel" />

      {checkoutVerifyError ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {checkoutVerifyError}
          </p>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-7xl px-6 pb-28 pt-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_minmax(0,1fr)] md:gap-6">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl md:sticky md:top-6 md:self-start">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  isEventUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isEventPast ? '⚫ Pasado' : isEventUpcoming ? '🟢 Próximo' : '🟡 Hoy'}
              </span>
              <h1 className="mt-3 text-2xl font-bold text-gray-900">Resumen del evento</h1>
              <p className="mt-1 text-sm text-gray-600">{event.title}</p>
              <p className="mt-2 text-sm text-gray-700">{`📅 ${formatSpanishFullDate(event.event_date)}`}</p>
              <p className="text-sm text-gray-700">
                {event.pickup_time
                  ? `🕒 ${formatTimeValue(event.start_time)} a ${formatTimeValue(event.pickup_time)}`
                  : `🕒 A las ${formatTimeValue(event.start_time)}`}
              </p>

              <p className="mt-2 text-xs leading-tight text-gray-400 whitespace-nowrap">{confirmacionesLine}</p>

              {hasLocationDetails ? (
                <div className="mt-3 space-y-1">
                  {event.location_name != null && String(event.location_name).trim() !== '' ? (
                    <p className="text-sm text-gray-700">{`📍 ${event.location_name}`}</p>
                  ) : null}
                  {event.location_address != null && String(event.location_address).trim() !== '' ? (
                    <p className="text-sm text-gray-500">{event.location_address}</p>
                  ) : null}
                  {event.google_maps_url != null && String(event.google_maps_url).trim() !== '' ? (
                    <a
                      href={event.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-block text-sm font-medium no-underline ${accentTextClass}`}
                    >
                      🗺️ Ver en Google Maps
                    </a>
                  ) : null}
                </div>
              ) : null}

              {dashboardGiftLine ? <p className="mt-3 text-sm text-gray-700">{dashboardGiftLine}</p> : null}

              {event.enable_food_options && foodOptionLabels.length > 0 ? (
                <p className="mt-3 text-sm text-gray-700">{`🍽️ ${foodOptionLabels.join(' · ')}`}</p>
              ) : null}

              {event.organizer_notes != null && String(event.organizer_notes).trim() !== '' ? (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-900">📋 Notas para los invitados</p>
                  <p className="mt-1 text-sm text-gray-500 italic">{event.organizer_notes.trim()}</p>
                </div>
              ) : null}

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

              {isEventPast ? (
                <div className="mt-4">
                  <Link
                    href={`/dashboard/eventos/nuevo?fromEvent=${encodeURIComponent(event.public_slug)}`}
                    className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${primaryButtonClass}`}
                  >
                    Copiar y repetir
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <Link
                      href={`/dashboard/eventos/${event.public_slug}/editar?theme=${event.invitation_theme ?? 'yellow'}`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Editar evento
                </Link>
              </div>

              <div ref={inviteShareSectionRef} id="event-share-section" className="mt-4">
                <div>
                  <p className="text-xs text-gray-400">Enlace de invitación</p>
                  <div className="mt-1 flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-1">
                    <p className="min-w-0 flex-1 truncate text-sm text-gray-600">
                      {`miparty.net/e/${event.public_slug}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://miparty.net/e/${event.public_slug}`
                        void navigator.clipboard.writeText(url).then(() => {
                          if (copyInviteLinkTimeoutRef.current != null) {
                            clearTimeout(copyInviteLinkTimeoutRef.current)
                          }
                          setInviteLinkCopied(true)
                          copyInviteLinkTimeoutRef.current = setTimeout(() => {
                            setInviteLinkCopied(false)
                            copyInviteLinkTimeoutRef.current = null
                          }, 2000)
                        })
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      {inviteLinkCopied ? (
                        '¡Copiado!'
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <Link
                  href={`/e/${event.public_slug}?preview=true&theme=${event.invitation_theme ?? 'yellow'}&from=dashboard`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  Cómo ven la invitación mis invitados
                </Link>
                <ShareButton
                  eventTitle={event.title}
                  childName={event.child_name}
                  slug={event.public_slug}
                  className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${primaryButtonClass}`}
                />
              </div>
                </>
              )}
            </section>
          </aside>

          <div className="w-full space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
              <div className="mx-auto grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toggleFilter('confirmed')}
                  className={`cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-transform hover:scale-105 hover:shadow ${
                    activeFilters.length === 0
                      ? 'opacity-100'
                      : activeFilters.includes('confirmed')
                        ? `opacity-100 ring-2 ring-offset-2 ring-offset-white ${statRingActiveClass} shadow-md`
                        : 'opacity-50'
                  }`}
                >
                  <p className="text-xs text-gray-600">✅ Confirmados</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{confirmedCount}</p>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('declined')}
                  className={`cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-transform hover:scale-105 hover:shadow ${
                    activeFilters.length === 0
                      ? 'opacity-100'
                      : activeFilters.includes('declined')
                        ? `opacity-100 ring-2 ring-offset-2 ring-offset-white ${statRingActiveClass} shadow-md`
                        : 'opacity-50'
                  }`}
                >
                  <p className="text-xs text-gray-600">❌ No pueden</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{declinedCount}</p>
                </button>
              </div>
              {rsvps.length === 0 ? (
                <>
                  {responsesSectionHeader}
                  <p className="mb-2 mt-3 text-left text-xs text-gray-400">Así se verán las respuestas</p>
                  {viewMode === 'cards' ? (
                    <>
                      {!anyDemoRowVisible ? (
                        <p className="text-center text-sm text-gray-600">No hay respuestas con estos filtros.</p>
                      ) : (
                        <div className="space-y-3">
                          {showDemoLucía ? (
                            <article className="pointer-events-none rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 opacity-70">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-500">Lucía Pérez</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex rounded-lg p-2 text-gray-400">
                                    <Contact className="h-4 w-4" aria-hidden />
                                  </span>
                                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                    ✅ Sí
                                  </span>
                                </div>
                              </div>
                              {showFoodColumn ? (
                                <p className="mt-2 text-sm text-gray-500">🍕 Pizza</p>
                              ) : null}
                              <p className="mt-1 rounded-lg bg-gray-100/80 px-2 py-1 text-sm italic text-gray-500">
                                💬 ¡Qué ilusión, gracias por invitarnos!
                              </p>
                            </article>
                          ) : null}
                          {showDemoEmma ? (
                            <article className="pointer-events-none rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 opacity-70">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-500">Emma García</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex rounded-lg p-2 text-gray-400">
                                    <Contact className="h-4 w-4" aria-hidden />
                                  </span>
                                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                    ❌ No puede ir
                                  </span>
                                </div>
                              </div>
                              <p className="mt-1 rounded-lg bg-gray-100/80 px-2 py-1 text-sm italic text-gray-500">
                                💬 Lo sentimos, ese día tenemos compromiso
                              </p>
                            </article>
                          ) : null}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-full overflow-x-auto">
                        <table className="w-full table-auto text-left text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-xs font-medium text-gray-600">
                              <th className="whitespace-nowrap px-3 py-2">Invitado/a</th>
                              <th className="whitespace-nowrap px-3 py-2 text-center">Contacto</th>
                              <th className="whitespace-nowrap px-3 py-2">Estado</th>
                              {showFoodColumn ? (
                                <th className="whitespace-nowrap px-3 py-2">Comida</th>
                              ) : null}
                              <th className="whitespace-nowrap px-3 py-2">Alergias</th>
                              <th className="whitespace-nowrap px-3 py-2 min-w-[120px]">Mensaje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!anyDemoRowVisible ? (
                              <tr>
                                <td
                                  colSpan={rsvpTableColCount}
                                  className="whitespace-nowrap px-3 py-4 text-center text-sm text-gray-600"
                                >
                                  No hay respuestas con estos filtros.
                                </td>
                              </tr>
                            ) : (
                              <>
                                {showDemoLucía ? (
                                  <tr className="border-b border-gray-100 bg-gray-50 italic text-gray-400 opacity-70">
                                    <td className="whitespace-nowrap px-3 py-2 font-medium">Lucía Pérez</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-center text-gray-400">
                                      <Contact className="mx-auto h-4 w-4" aria-hidden />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">
                                        ✅ Sí
                                      </span>
                                    </td>
                                    {showFoodColumn ? (
                                      <td className="whitespace-nowrap px-3 py-2" title="🍕 Pizza">
                                        🍕 Pizza
                                      </td>
                                    ) : null}
                                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
                                    <td className="whitespace-nowrap px-3 py-2 min-w-[120px] text-gray-700" title="¡Qué ilusión, gracias por invitarnos!">
                                      ¡Qué ilusión, gracias por invitarnos!
                                    </td>
                                  </tr>
                                ) : null}
                                {showDemoEmma ? (
                                  <tr className="border-b border-gray-100 bg-gray-50 italic text-gray-400 opacity-70">
                                    <td className="whitespace-nowrap px-3 py-2 font-medium">Emma García</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-center text-gray-400">
                                      <Contact className="mx-auto h-4 w-4" aria-hidden />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">
                                        ❌ No puede ir
                                      </span>
                                    </td>
                                    {showFoodColumn ? (
                                      <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
                                    ) : null}
                                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
                                    <td className="whitespace-nowrap px-3 py-2 min-w-[120px] text-gray-700" title="Lo sentimos, ese día tenemos compromiso">
                                      Lo sentimos, ese día tenemos compromiso
                                    </td>
                                  </tr>
                                ) : null}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-4 text-center">
                    <p className="text-sm text-gray-600">
                      Aún no hay respuestas. Comparte tu invitación para empezar a recibir confirmaciones 🎉
                    </p>
                    <ShareButton
                      eventTitle={event.title}
                      childName={event.child_name}
                      slug={event.public_slug}
                      className={`mt-2 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${primaryButtonClass}`}
                    />
                  </div>
                </>
              ) : (
                <>
                  {responsesSectionHeader}
                  {viewMode === 'cards' ? (
                    filteredRsvps.length === 0 ? (
                      <p className="mt-3 text-center text-sm text-gray-600">No hay respuestas con estos filtros.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {filteredRsvps.map((rsvp) => {
                          const status = rsvpStatusMeta(rsvp.attendance_status)
                          const fullChildName = rsvp.child_name.trim()
                          const familyBadge = event ? getFamilyRsvpBadge(rsvp, event.child_name) : null
                          const allergyDisplay = normalizeRsvpAllergyNotesForStorage(rsvp.allergy_notes)
                          return (
                            <article
                              key={rsvp.id}
                              className={`rounded-xl border border-gray-200 p-3 shadow-sm ${
                                rsvp.is_family ? 'bg-yellow-50' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900">{fullChildName}</p>
                                    {familyBadge ? (
                                      <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-900">
                                        {familyBadge.emoji} {familyBadge.label}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <RsvpContactIconButton
                                    rsvp={rsvp}
                                    onOpen={setGuestContactModal}
                                  />
                                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${status.badge}`}>
                                    {status.label}
                                  </span>
                                  <RsvpEditIconButton onClick={() => setEditingRsvp(rsvp)} />
                                </div>
                              </div>
                              {showFoodColumn && rsvp.food_preference ? (
                                <p className="mt-2 text-sm text-gray-700">{`🍽️ ${rsvp.food_preference}`}</p>
                              ) : null}
                              {allergyDisplay ? (
                                <p className="mt-1 text-sm text-gray-700">{`⚠️ ${allergyDisplay}`}</p>
                              ) : null}
                              {rsvp.extra_notes ? (
                                <p className="mt-1 rounded-lg bg-gray-50 px-2 py-1 text-sm italic text-gray-600">{`💬 ${rsvp.extra_notes}`}</p>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    )
                  ) : (
                    <div className="mt-3 w-full overflow-x-auto">
                      <table className="w-full table-auto text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
                          <tr className="border-b border-gray-200 text-xs font-medium text-gray-600">
                            <th className="whitespace-nowrap px-3 py-2">Invitado/a</th>
                            <th className="whitespace-nowrap px-3 py-2 text-center">Contacto</th>
                            <th className="whitespace-nowrap px-3 py-2">Estado</th>
                            {showFoodColumn ? (
                              <th className="whitespace-nowrap px-3 py-2">Comida</th>
                            ) : null}
                            <th className="whitespace-nowrap px-3 py-2">Alergias</th>
                            <th className="whitespace-nowrap px-3 py-2">Mensaje</th>
                            <th className="whitespace-nowrap px-2 py-2 text-center">
                              <span className="sr-only">Editar</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRsvps.length === 0 ? (
                            <tr>
                              <td
                                colSpan={rsvpTableColCount}
                                className="whitespace-nowrap px-3 py-4 text-center text-sm text-gray-600"
                              >
                                No hay respuestas con estos filtros.
                              </td>
                            </tr>
                          ) : (
                            filteredRsvps.map((rsvp) => {
                            const status = rsvpStatusMeta(rsvp.attendance_status)
                            const fullChildName = rsvp.child_name.trim()
                            const familyBadge = event ? getFamilyRsvpBadge(rsvp, event.child_name) : null
                            const foodRaw = (rsvp.food_preference ?? '').trim()
                            const foodDisplay = foodRaw ? `🍽️ ${foodRaw}` : ''
                            const allergyRaw = normalizeRsvpAllergyNotesForStorage(rsvp.allergy_notes) ?? ''
                            const messageRaw = (rsvp.extra_notes ?? '').trim()
                            return (
                              <tr
                                key={rsvp.id}
                                className={`border-b border-gray-100 ${rsvp.is_family ? 'bg-yellow-50' : ''}`}
                              >
                                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>{fullChildName}</span>
                                    {familyBadge ? (
                                      <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-900">
                                        {familyBadge.emoji} {familyBadge.label}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-center">
                                  <RsvpContactIconButton
                                    rsvp={rsvp}
                                    onOpen={setGuestContactModal}
                                    className="mx-auto"
                                  />
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <span
                                    className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${status.badge}`}
                                  >
                                    {status.label}
                                  </span>
                                </td>
                                {showFoodColumn ? (
                                  <td
                                    className="whitespace-nowrap px-3 py-2 text-gray-700"
                                    title={foodDisplay || undefined}
                                  >
                                    {foodRaw ? (
                                      foodDisplay
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                ) : null}
                                <td className="whitespace-nowrap px-3 py-2 text-gray-700" title={allergyRaw || undefined}>
                                  {allergyRaw ? allergyRaw : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-center text-gray-700">
                                  {messageRaw ? (
                                    <span title={messageRaw} className="inline-flex text-gray-600">
                                      <MessageCircle className="h-4 w-4" aria-hidden />
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-center">
                                  <RsvpEditIconButton
                                    onClick={() => setEditingRsvp(rsvp)}
                                    className="mx-auto"
                                  />
                                </td>
                              </tr>
                            )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            {(event.enable_food_options && foodPreferenceCounts.length > 0) || allergyEntries.length > 0 ? (
              <section className={`rounded-2xl border shadow-xl ${accentBorderClass} ${accentSoftBgClass}`}>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-left text-base font-semibold text-gray-900">🍽️ Comida y alergias</h2>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label="Copiar comida y alergias"
                        title="Copiar resumen"
                        onClick={() => void copyComidaYAlergias()}
                        className={exportIconButtonClass}
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Compartir comida y alergias"
                        title="Compartir resumen"
                        onClick={() => void shareComidaYAlergias()}
                        className={exportIconButtonClass}
                      >
                        <Share2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {event.enable_food_options && foodPreferenceCounts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {foodPreferenceCounts.map((item) => (
                        <div
                          key={item.label}
                          className={`inline-flex min-w-0 max-w-full flex-[1_1_calc(33.333%-0.34rem)] items-center gap-2 rounded-full px-3 py-1.5 text-sm ${accentPillSoftBgClass} ${accentTextClass}`}
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                          <span className="shrink-0 font-bold" aria-label={`${item.count} personas`}>
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {allergyEntries.length > 0 ? (
                    <div
                      className={`rounded-lg border border-yellow-200 bg-yellow-50 p-3 ${
                        event.enable_food_options && foodPreferenceCounts.length > 0 ? 'mt-4' : 'mt-3'
                      }`}
                    >
                      <h3 className="text-sm font-semibold text-amber-900">⚠️ Alergias e intolerancias</h3>
                      <div className="mt-2 space-y-1.5 text-sm leading-snug text-amber-900">
                        {allergyEntries.map((entry, index) => (
                          <p key={`${entry.childName}-${index}`} className="break-words">
                            {entry.childName} |{' '}
                            {entry.foodSelected ? entry.foodSelected : 'Sin comida seleccionada'} | {entry.note}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <div
        data-sticky-action-bar
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm"
      >
        <div className="mx-auto w-full max-w-7xl px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setShowAddGuestModal(true)}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${primaryButtonClass}`}
          >
            + Añadir respuesta manualmente
          </button>
        </div>
      </div>

      {guestContactModal ? (
        <GuestContactModal
          contact={guestContactModal}
          onClose={() => setGuestContactModal(null)}
          onToast={showToast}
        />
      ) : null}

      {showAddGuestModal && event ? (
        <OrganizerAddGuestModal
          eventId={event.id}
          enableFoodOptions={Boolean(event.enable_food_options)}
          foodOptionLabels={foodOptionLabels}
          primaryButtonClass={primaryButtonClass}
          onClose={() => setShowAddGuestModal(false)}
          onSaved={(created) => {
            setRsvps((prev) => [created, ...prev])
          }}
          onToast={showToast}
        />
      ) : null}

      {editingRsvp && event ? (
        <OrganizerRsvpEditModal
          rsvp={editingRsvp}
          eventId={event.id}
          enableFoodOptions={Boolean(event.enable_food_options)}
          foodOptionLabels={foodOptionLabels}
          primaryButtonClass={primaryButtonClass}
          onClose={() => setEditingRsvp(null)}
          onSaved={(updated) => {
            setRsvps((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
          }}
          onDeleted={(id) => {
            setRsvps((prev) => prev.filter((row) => row.id !== id))
          }}
          onToast={showToast}
        />
      ) : null}

      {toastMessage ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toastMessage}
        </div>
      ) : null}
    </main>
  )
}
