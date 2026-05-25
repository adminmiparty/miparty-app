'use client'

import AppNav from '@/components/AppNav'
import EventCreationSteps from '@/components/EventCreationSteps'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { brand } from '@/lib/brand'
import {
  buildPathWithTheme,
  eventFormBrandUi,
  eventFormPageMainClass,
  resolveThemeOrBrand,
  restoreInvitationThemeFromDb,
  sharePageThemeFromUrl,
} from '@/lib/eventFormTheme'
import { createClient } from '@/lib/supabase/client'
import { postStripeCheckout } from '@/lib/stripe/checkoutClient'
import { verifyCheckoutReturnWithRetry } from '@/lib/stripe/verifyCheckoutReturn'
import {
  decidePublishBilling,
  getOrganizerBillingConfig,
  type OrganizerBillingConfig,
} from '@/lib/organizerBilling'
import { EVENT_STATUS_ACTIVE, EVENT_STATUS_DRAFT, isActiveEventStatus } from '@/lib/eventLifecycle'
import { themes, type ThemeKey } from '@/lib/themes'

type EventShareRow = {
  id: string
  user_id: string
  title: string
  child_name: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool' | null
  bizum_phone: string | null
  organizer_notes: string | null
  invitation_image_url: string | null
  invitation_image_fit: 'contain' | 'cover' | null
  invitation_image_position: string | null
  invitation_image_zoom: number | null
  public_slug: string
  birthday_number: number | null
  rsvp_deadline_days: number | null
  enable_food_options: boolean | null
  organizer_phone: string | null
  organizer_name: string | null
  invitation_theme: string | null
  status?: string | null
}

function parseInvitationPosition(position: string | null) {
  if (!position || position.trim() === '') {
    return { x: 50, y: 50 }
  }
  const parts = position.trim().split(/\s+/)
  const x = Number.parseFloat((parts[0] ?? '50').replace('%', ''))
  const y = Number.parseFloat((parts[1] ?? '50').replace('%', ''))
  return {
    x: Number.isFinite(x) ? x : 50,
    y: Number.isFinite(y) ? y : 50,
  }
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatEventDateSpanish(isoDate: string) {
  try {
    return capitalizeFirst(format(parseISO(isoDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))
  } catch {
    return isoDate
  }
}

function formatRsvpConfirmacionesLine(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return capitalizeFirst(format(deadline, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))
}

function formatTimeRecap(start: string, pickup: string | null) {
  const s = start.length >= 5 ? start.slice(0, 5) : start
  if (!pickup || pickup.trim() === '') {
    return s
  }
  const p = pickup.length >= 5 ? pickup.slice(0, 5) : pickup
  return `${s} – ${p}`
}

function digitsForWhatsApp(phone: string) {
  return phone.replace(/\D/g, '')
}

/** National number only (no +34 / +57 prefix) for Paso 2 recap. */
function organizerPhoneLocalNumber(phone: string) {
  const trimmed = phone.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('+57')) return trimmed.slice(3).trim()
  if (trimmed.startsWith('+34')) return trimmed.slice(3).trim()
  if (trimmed.startsWith('+52')) return trimmed.slice(3).trim()
  const intlMatch = trimmed.match(/^\+\d{1,4}(.+)$/)
  if (intlMatch) return intlMatch[1].trim()
  return trimmed.replace(/^\+/, '').trim()
}

function formatGiftLine(event: EventShareRow): string {
  const g = event.gift_option
  if (g === 'sin_regalo') {
    return '🚫 Sin regalo'
  }
  if (g === 'regalo_libre') {
    return '🎁 Regalo libre'
  }
  if (g === 'bizum_pool') {
    const phone = (event.bizum_phone ?? '').trim()
    if (!phone) {
      return '🎁 Hucha al móvil'
    }
    if (phone.startsWith('+34')) {
      return `🎁 Hucha al móvil ${phone.slice(3)} (Bizum)`
    }
    if (phone.startsWith('+52')) {
      return `🎁 Nequi al celular ${phone.slice(3)}`
    }
    return `🎁 Hucha al móvil ${phone}`
  }
  return '🎁 Regalo libre'
}

const primaryButtonTextMap: Record<ThemeKey, string> = {
  yellow: 'text-gray-900',
  pink: 'text-white',
  blue: 'text-white',
  green: 'text-gray-900',
  purple: 'text-white',
}

const progressAccentMap: Record<ThemeKey, string> = {
  yellow: 'bg-yellow-400',
  pink: 'bg-pink-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  purple: 'bg-purple-400',
}

const progressTrackMap: Record<ThemeKey, string> = {
  yellow: 'bg-yellow-100',
  pink: 'bg-pink-100',
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  purple: 'bg-purple-100',
}

const previewThemeClasses: Record<ThemeKey, { card: string }> = {
  yellow: { card: 'bg-yellow-50 border-yellow-200' },
  pink: { card: 'bg-pink-50 border-pink-200' },
  blue: { card: 'bg-blue-50 border-blue-200' },
  green: { card: 'bg-green-50 border-green-200' },
  purple: { card: 'bg-purple-50 border-purple-200' },
}

const linkAccentMap: Record<ThemeKey, string> = {
  yellow: 'text-yellow-600 hover:text-yellow-700',
  pink: 'text-pink-600 hover:text-pink-700',
  blue: 'text-blue-600 hover:text-blue-700',
  green: 'text-green-600 hover:text-green-700',
  purple: 'text-purple-600 hover:text-purple-700',
}

const brandMap: Record<ThemeKey, string> = {
  yellow: 'text-yellow-500',
  pink: 'text-pink-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
  purple: 'text-purple-500',
}

const focusRingMap: Record<ThemeKey, string> = {
  yellow: 'focus:ring-yellow-400',
  pink: 'focus:ring-pink-400',
  blue: 'focus:ring-blue-400',
  green: 'focus:ring-green-400',
  purple: 'focus:ring-purple-400',
}

const secondaryOutlineClass =
  'flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50'

export default function EventSharePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const slugParam = params?.slug
  const slug =
    typeof slugParam === 'string' ? slugParam : Array.isArray(slugParam) ? slugParam[0] ?? '' : ''

  const urlTheme = useMemo(() => sharePageThemeFromUrl(searchParams.get('theme')), [searchParams])

  const [event, setEvent] = useState<EventShareRow | null>(null)
  const [foodLabels, setFoodLabels] = useState<string[]>([])
  const [billingConfig] = useState<OrganizerBillingConfig>(() => getOrganizerBillingConfig())
  const [publishMessage, setPublishMessage] = useState('')
  const [publishRequiresPayment, setPublishRequiresPayment] = useState(false)
  const [isDraft, setIsDraft] = useState(true)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [confirmingCheckoutReturn, setConfirmingCheckoutReturn] = useState(false)

  const effectiveTheme = useMemo(
    () => urlTheme ?? (event ? restoreInvitationThemeFromDb(event.invitation_theme) : null),
    [urlTheme, event?.invitation_theme]
  )

  const pageBgMap: Record<string, string> = {
    yellow: 'from-yellow-50 to-white',
    pink: 'from-pink-50 to-white',
    blue: 'from-blue-50 to-white',
    green: 'from-green-50 to-white',
    purple: 'from-purple-50 to-white',
  }
  const pageMainClass = eventFormPageMainClass(effectiveTheme, pageBgMap)
  const themeDef = effectiveTheme ? (themes[effectiveTheme] ?? themes.yellow) : null
  const primaryButtonClass = themeDef
    ? `${themeDef.button} ${themeDef.buttonHover} ${primaryButtonTextMap[effectiveTheme!] ?? primaryButtonTextMap.yellow}`
    : brand.buttonPrimary
  const progressAccentClass = resolveThemeOrBrand(
    progressAccentMap,
    effectiveTheme,
    eventFormBrandUi.progressAccent
  )
  const progressTrackClass = resolveThemeOrBrand(
    progressTrackMap,
    effectiveTheme,
    eventFormBrandUi.progressTrack
  )
  const cardClass = effectiveTheme
    ? (previewThemeClasses[effectiveTheme]?.card ?? previewThemeClasses.yellow.card)
    : eventFormBrandUi.previewCard
  const linkAccent = resolveThemeOrBrand(
    linkAccentMap,
    effectiveTheme,
    `${brand.textBrandDark} ${brand.textBrandHover}`
  )
  const brandClass = resolveThemeOrBrand(brandMap, effectiveTheme, brand.textBrand)
  const focusRingClass = effectiveTheme
    ? (focusRingMap[effectiveTheme] ?? focusRingMap.yellow)
    : `focus:ring-[var(--brand-focus)]`
  const editShareQuery = effectiveTheme
    ? `?theme=${effectiveTheme}&from=share`
    : '?from=share'

  useEffect(() => {
    if (!slug) {
      router.replace('/dashboard')
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (!cancelled) {
          router.replace('/dashboard')
        }
        return
      }

      const { data: row, error: eventError } = await supabase
        .from('events')
        .select(
          'id, user_id, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, organizer_notes, organizer_phone, organizer_name, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom, public_slug, birthday_number, rsvp_deadline_days, enable_food_options, invitation_theme, status'
        )
        .eq('public_slug', slug)
        .maybeSingle<EventShareRow>()

      if (cancelled) {
        return
      }

      if (eventError || !row || row.user_id !== user.id) {
        router.replace('/dashboard')
        return
      }

      const status = row.status ?? EVENT_STATUS_DRAFT
      const draft = status === EVENT_STATUS_DRAFT
      const active = isActiveEventStatus(status)

      if (!draft && !active) {
        router.replace('/dashboard')
        return
      }

      setIsDraft(draft)

      if (draft) {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', EVENT_STATUS_ACTIVE)
        const decision = decidePublishBilling(count ?? 0, billingConfig)
        setPublishMessage(decision.message)
        setPublishRequiresPayment(decision.requiresPayment)
      }

      let labels: string[] = []
      if (row.enable_food_options) {
        const { data: foodRows } = await supabase
          .from('event_food_options')
          .select('label')
          .eq('event_id', row.id)
          .order('created_at', { ascending: true })

        if (!cancelled && foodRows) {
          labels = foodRows.map((r) => String((r as { label: string }).label).trim()).filter(Boolean)
        }
      }

      if (cancelled) {
        return
      }

      setFoodLabels(labels)
      setEvent(row)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug, supabase, router, billingConfig])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    if (checkout !== 'success' || !sessionId) return

    let cancelled = false
    const confirmPaymentReturn = async () => {
      setConfirmingCheckoutReturn(true)
      setPublishing(true)
      setPublishError(null)

      const result = await verifyCheckoutReturnWithRetry(sessionId)
      if (cancelled) return

      setPublishing(false)
      setConfirmingCheckoutReturn(false)

      if (result.status === 401) {
        setPublishError('Inicia sesión de nuevo para confirmar el pago.')
        return
      }

      if (!result.ok || !result.published || !result.slug) {
        setPublishError(
          result.error ??
            'El pago se recibió, pero el evento aún no está publicado. Espera unos segundos y recarga la página.'
        )
        return
      }

      router.replace(`/dashboard/eventos/${result.slug}?published=paid`)
    }

    void confirmPaymentReturn()
    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  const handlePublish = async () => {
    if (!event || !slug || !isDraft) {
      if (event && slug && !isDraft) {
        router.push(`/dashboard/eventos/${slug}`)
      }
      return
    }
    setPublishError(null)
    setPublishing(true)

    try {
      const publishRes = await fetch('/api/events/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const publishData = (await publishRes.json()) as {
        error?: string
        published?: boolean
        requiresPayment?: boolean
        slug?: string
        message?: string
      }

      if (!publishRes.ok) {
        setPublishError(publishData.error ?? 'No se pudo publicar.')
        setPublishing(false)
        return
      }

      if (publishData.published && publishData.slug) {
        router.push(`/dashboard/eventos/${publishData.slug}?published=free`)
        return
      }

      if (publishData.requiresPayment) {
        setPublishing(false)
        setShowPaymentModal(true)
        return
      }

      setPublishError('No se pudo publicar el evento.')
      setPublishing(false)
    } catch {
      setPublishError('No se pudo publicar el evento.')
      setPublishing(false)
    }
  }

  const startPaidCheckout = async (_source: 'main-cta' | 'modal-cta') => {
    if (!event?.id) {
      setPublishError('No se encontró el evento. Recarga la página.')
      return
    }

    setPublishError(null)
    setPublishing(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

      if (isMobile && session) {
        await supabase.auth.refreshSession()
      }

      if (!session) {
        setPublishError('Inicia sesión de nuevo para continuar con el pago.')
        setPublishing(false)
        return
      }

      const { ok, status, data } = await postStripeCheckout(event.id)

      if (!ok || !data.url) {
        if (status === 401) {
          setPublishError(
            'Tu sesión no se envió al servidor. Cierra la pestaña, vuelve a entrar desde el mismo enlace (miparty.net) e inténtalo de nuevo.'
          )
        } else {
          setPublishError(data.error ?? 'No se pudo iniciar el pago.')
        }
        setPublishing(false)
        return
      }

      setShowPaymentModal(false)
      window.location.assign(data.url)
    } catch {
      setPublishError('No se pudo iniciar el pago.')
      setPublishing(false)
    }
  }

  const imagePos = event ? parseInvitationPosition(event.invitation_image_position) : { x: 50, y: 50 }
  const imageFit = event?.invitation_image_fit === 'cover' ? 'cover' : 'contain'
  const imageZoom =
    event?.invitation_image_zoom != null && Number.isFinite(Number(event.invitation_image_zoom))
      ? Number(event.invitation_image_zoom)
      : 1

  const rsvpConfirmacionesLine = event
    ? event.rsvp_deadline_days != null &&
      event.rsvp_deadline_days > 0 &&
      Number.isFinite(event.rsvp_deadline_days)
      ? `Confirmaciones hasta el ${formatRsvpConfirmacionesLine(event.event_date, event.rsvp_deadline_days)}`
      : 'Confirmaciones hasta el día del evento'
    : ''

  const foodLine =
    event?.enable_food_options && foodLabels.length > 0 ? foodLabels.join(' · ') : null

  const hasLocation =
    event &&
    ((event.location_name != null && String(event.location_name).trim() !== '') ||
      (event.location_address != null && String(event.location_address).trim() !== ''))

  const organizerContactRecap = useMemo(() => {
    const rawPhone = event?.organizer_phone != null ? String(event.organizer_phone).trim() : ''
    if (!rawPhone) return null
    return {
      fullPhone: rawPhone,
      name: event?.organizer_name?.trim() ?? '',
      localPhone: organizerPhoneLocalNumber(rawPhone),
      whatsAppDigits: digitsForWhatsApp(rawPhone),
    }
  }, [event?.organizer_phone, event?.organizer_name])

  return (
    <main className={pageMainClass}>
      <AppNav
        backHref={
          isDraft && event
            ? buildPathWithTheme('/dashboard/eventos/nuevo', effectiveTheme, {
                draftId: event.id,
              })
            : `/dashboard/eventos/${slug}/editar${editShareQuery}`
        }
        backLabel="⬅️ Volver al Paso 1"
        centerSlot={
          <EventCreationSteps
            variant="nav"
            step={2}
            progressAccentClass={progressAccentClass}
            progressTrackClass={progressTrackClass}
            progressCardBorderClass={eventFormBrandUi.progressCardBorder}
          />
        }
      />

      <div className="mx-auto w-full max-w-sm px-4 py-6 pb-8">
        <section className={`rounded-2xl border p-5 shadow-xl ${cardClass}`}>
          {confirmingCheckoutReturn ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-gray-900">Confirmando tu pago…</p>
              <p className="mt-2 text-sm text-gray-600">
                En unos segundos podrás compartir tu invitación.
              </p>
            </div>
          ) : loading ? (
            <p className="text-center text-sm text-gray-600">Cargando...</p>
          ) : event ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h1 className="min-w-0 shrink text-xl font-bold leading-tight tracking-tight text-gray-900 sm:text-2xl">
                    <span className="whitespace-nowrap">¡Tu invitación está lista!</span>
                  </h1>
                  <span
                    className="shrink-0 text-lg leading-none sm:text-2xl"
                    aria-hidden
                  >
                    🎉
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">Revisa los detalles antes de compartirla.</p>
              </div>

              <div className="space-y-4 rounded-xl border border-gray-200 bg-white/90 p-4">
                {event.invitation_image_url ? (
                  <div className="relative w-full max-h-72 overflow-hidden rounded-xl">
                    <img
                      src={event.invitation_image_url}
                      alt=""
                      style={{
                        objectPosition: imageFit === 'cover' ? `${imagePos.x}% ${imagePos.y}%` : undefined,
                        transform: imageFit === 'cover' ? `scale(${imageZoom})` : undefined,
                        transformOrigin: `${imagePos.x}% ${imagePos.y}%`,
                      }}
                      className={`max-h-72 w-full transition-transform ${
                        imageFit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'
                      }`}
                    />
                  </div>
                ) : null}

                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-lg" aria-hidden>
                    🎂
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold text-gray-900">{event.title}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="shrink-0" aria-hidden>
                    📅
                  </span>
                  <p className="text-sm text-gray-900">{formatEventDateSpanish(event.event_date)}</p>
                </div>

                {event ? (
                  <p className="text-sm text-gray-500">{rsvpConfirmacionesLine}</p>
                ) : null}

                <div className="flex gap-2">
                  <span className="shrink-0" aria-hidden>
                    🕐
                  </span>
                  <p className="text-sm text-gray-900">{formatTimeRecap(event.start_time, event.pickup_time)}</p>
                </div>

                {hasLocation ? (
                  <div className="flex gap-2">
                    <span className="shrink-0" aria-hidden>
                      📍
                    </span>
                    <div className="min-w-0">
                      {event.location_name != null && String(event.location_name).trim() !== '' ? (
                        <p className="text-sm font-medium text-gray-900">{event.location_name}</p>
                      ) : null}
                      {event.location_address != null && String(event.location_address).trim() !== '' ? (
                        <p className="text-sm text-gray-600">{event.location_address}</p>
                      ) : null}
                      {event.google_maps_url ? (
                        <a
                          href={event.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mt-1 inline-block text-sm font-medium underline ${linkAccent}`}
                        >
                          Ver en Google Maps ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : event.google_maps_url ? (
                  <a
                    href={event.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block text-sm font-medium underline ${linkAccent}`}
                  >
                    Ver en Google Maps ↗
                  </a>
                ) : null}

                <p className="text-sm text-gray-900">{formatGiftLine(event)}</p>

                {foodLine ? (
                  <p className="text-sm text-gray-900">
                    <span aria-hidden>🍕 </span>
                    {foodLine}
                  </p>
                ) : null}

                {organizerContactRecap ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      <span aria-hidden>📞</span> Contacto
                    </p>
                    <div className="mt-1 flex flex-nowrap items-center gap-x-2 text-sm text-gray-900">
                      {organizerContactRecap.name ? (
                        <span className="font-medium text-gray-900">{organizerContactRecap.name}</span>
                      ) : null}
                      <a
                        href={`tel:${organizerContactRecap.fullPhone}`}
                        className={`font-medium underline ${linkAccent}`}
                      >
                        {organizerContactRecap.localPhone}
                      </a>
                      {organizerContactRecap.whatsAppDigits.length >= 8 ? (
                        <a
                          href={`https://wa.me/${organizerContactRecap.whatsAppDigits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 text-green-500 transition hover:text-[#25D366]"
                          aria-label="WhatsApp"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-5 w-5"
                            aria-hidden
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {event.organizer_notes ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-800">
                      <span aria-hidden>📋 </span>
                      Mensaje para los invitados
                    </p>
                    <p className="whitespace-pre-wrap text-center text-sm italic text-gray-700">{event.organizer_notes}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <Link href={`/dashboard/eventos/${slug}/editar${editShareQuery}`} className={secondaryOutlineClass}>
                  Editar evento
                </Link>
                <a
                  href={`/e/${event.public_slug}?preview=true&from=share${effectiveTheme ? `&theme=${effectiveTheme}` : ''}`}
                  className={secondaryOutlineClass}
                >
                  Visualizar la invitación
                </a>
              </div>

              {isDraft ? (
                <div className="border-t border-gray-200 pt-6">
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-gradient-to-b from-white to-[var(--brand-primary-light)]/40 p-5 shadow-sm">
                    <h2 className="text-center text-lg font-bold leading-snug text-gray-900">
                      Publica tu invitación para empezar a enviarla a tus invitados 🎉
                    </h2>
                    <div className="mt-5 rounded-xl border border-gray-200/80 bg-white px-4 py-4 text-center shadow-sm">
                      {publishRequiresPayment ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Pago único
                          </p>
                          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
                            {billingConfig.priceLabel}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            Sin suscripciones. Sin costes ocultos.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-accent-dark)]">
                            Primer evento gratis
                          </p>
                          <p className="mt-2 text-lg font-medium tabular-nums text-gray-400 line-through">
                            {billingConfig.priceLabel}
                          </p>
                          <p className="mt-1 text-3xl font-bold text-gray-900">Gratis</p>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() =>
                        void (publishRequiresPayment
                          ? startPaidCheckout('main-cta')
                          : handlePublish())
                      }
                      className={`mt-5 w-full rounded-lg px-4 py-3.5 text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${primaryButtonClass}`}
                    >
                      {publishing ? 'Un momento…' : 'Publicar y compartir'}
                    </button>
                    <p className="mt-2.5 text-center text-[11px] leading-snug text-gray-400">
                      {publishRequiresPayment
                        ? 'Pago seguro con Stripe'
                        : 'Tu primer evento en MiParty va por nuestra cuenta.'}
                    </p>
                    {publishError ? (
                      <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {publishError}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-200 pt-6">
                  <p className="text-center text-sm text-gray-600">
                    Tu evento ya está publicado. Comparte el enlace con tus invitados.
                  </p>
                  <Link
                    href={`/dashboard/eventos/${slug}`}
                    className={`mt-4 block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 ${focusRingClass} ${primaryButtonClass}`}
                  >
                    Ir al panel del evento
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 z-10 p-1 text-lg leading-none text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
            <h2 id="payment-modal-title" className="text-xl font-bold text-center text-gray-900">
              Tu invitación ya está lista 🎉
            </h2>
            <p className="mt-4 text-center text-sm text-gray-700">{publishMessage}</p>
            {publishRequiresPayment ? (
              <>
                <p className={`mt-3 text-center text-3xl font-bold ${brandClass}`}>
                  {billingConfig.priceLabel}
                </p>
                <p className="mt-2 text-center text-sm text-gray-600">
                  Pago único por evento. Sin suscripciones.
                </p>
              </>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={publishing}
                onClick={() => {
                  if (publishRequiresPayment) {
                    void startPaidCheckout('modal-cta')
                  } else {
                    setShowPaymentModal(false)
                    void handlePublish()
                  }
                }}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${primaryButtonClass}`}
              >
                {publishing
                  ? 'Un momento…'
                  : publishRequiresPayment
                    ? `Ver y compartir mi evento · ${billingConfig.priceLabel}`
                    : 'Ver y compartir mi primer evento!'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Comparte tu invitación y empieza a recibir respuestas en tu plataforma de eventos
                MiParty.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
