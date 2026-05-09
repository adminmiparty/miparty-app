'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { getTheme, themes, type ThemeKey } from '@/lib/themes'

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
}

function parseThemeParam(raw: string | null): ThemeKey {
  if (raw === 'yellow' || raw === 'pink' || raw === 'blue' || raw === 'green' || raw === 'purple') {
    return raw
  }
  return 'yellow'
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

  const themeKey = useMemo(() => parseThemeParam(searchParams.get('theme')), [searchParams])

  const themeDef = themes[themeKey] ?? themes.yellow
  const pageBg = getTheme(themeKey).pageBg
  const primaryButtonClass = `${themeDef.button} ${themeDef.buttonHover} ${primaryButtonTextMap[themeKey] ?? primaryButtonTextMap.yellow}`
  const progressAccentClass = progressAccentMap[themeKey] ?? progressAccentMap.yellow
  const progressTrackClass = progressTrackMap[themeKey] ?? progressTrackMap.yellow
  const cardClass = previewThemeClasses[themeKey]?.card ?? previewThemeClasses.yellow.card
  const linkAccent = linkAccentMap[themeKey] ?? linkAccentMap.yellow
  const brandClass = brandMap[themeKey] ?? brandMap.yellow
  const focusRingClass = focusRingMap[themeKey] ?? focusRingMap.yellow

  const [event, setEvent] = useState<EventShareRow | null>(null)
  const [foodLabels, setFoodLabels] = useState<string[]>([])
  const [freeEventAvailable, setFreeEventAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

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

      const [{ data: row, error: eventError }, { data: profile }] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, user_id, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, organizer_notes, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom, public_slug, birthday_number, rsvp_deadline_days, enable_food_options'
          )
          .eq('public_slug', slug)
          .maybeSingle<EventShareRow>(),
        supabase.from('users').select('free_event_available').eq('id', user.id).maybeSingle(),
      ])

      if (cancelled) {
        return
      }

      if (eventError || !row || row.user_id !== user.id) {
        router.replace('/dashboard')
        return
      }

      setFreeEventAvailable(profile?.free_event_available === true)

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
  }, [slug, supabase, router])

  const handlePublish = async () => {
    if (!event || !slug) {
      return
    }
    setPublishError(null)
    setPublishing(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setPublishing(false)
      router.replace('/dashboard')
      return
    }

    const { error: eventUpdateError } = await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('public_slug', slug)

    if (eventUpdateError) {
      setPublishError(eventUpdateError.message ?? 'No se pudo publicar.')
      setPublishing(false)
      return
    }

    const wasFree = freeEventAvailable
    if (wasFree) {
      const { error: profileError } = await supabase
        .from('users')
        .update({ free_event_available: false })
        .eq('id', user.id)

      if (profileError) {
        setPublishError(profileError.message ?? 'No se pudo actualizar tu perfil.')
        setPublishing(false)
        return
      }
    }

    router.push(`/dashboard/events/${slug}`)
  }

  const imagePos = event ? parseInvitationPosition(event.invitation_image_position) : { x: 50, y: 50 }
  const imageFit = event?.invitation_image_fit === 'cover' ? 'cover' : 'contain'
  const imageZoom =
    event?.invitation_image_zoom != null && Number.isFinite(Number(event.invitation_image_zoom))
      ? Number(event.invitation_image_zoom)
      : 1

  const rsvpConfirmacionesLine =
    event &&
    event.rsvp_deadline_days != null &&
    event.rsvp_deadline_days > 0 &&
    Number.isFinite(event.rsvp_deadline_days)
      ? formatRsvpConfirmacionesLine(event.event_date, event.rsvp_deadline_days)
      : null

  const foodLine =
    event?.enable_food_options && foodLabels.length > 0 ? foodLabels.join(' · ') : null

  const hasLocation =
    event &&
    ((event.location_name != null && String(event.location_name).trim() !== '') ||
      (event.location_address != null && String(event.location_address).trim() !== ''))

  return (
    <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
      <div
        className={`sticky top-0 z-50 w-full border-b border-gray-200 ${themeDef.bg}/95 shadow-sm backdrop-blur-sm`}
      >
        <div className="mx-auto w-full max-w-md px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link
              href={`/dashboard/events/${slug}/edit?theme=${themeKey}&from=share`}
              className="inline-flex items-center text-sm font-medium text-gray-900 hover:underline"
            >
              ← Volver al Paso 1
            </Link>
            <p className={`text-sm font-semibold ${brandClass}`}>MiParty</p>
          </div>
          <div className="border-t border-gray-200/60 pb-3 pt-2">
            <div className="rounded-xl border border-yellow-100 bg-white/80 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
                <span className="text-gray-400 font-normal">Paso 1 — Crea tu evento</span>
                <span className="text-gray-900 font-semibold">Paso 2 — Revisa tu invitación</span>
              </div>
              <div className={`h-2 w-full rounded-full ${progressTrackClass}`}>
                <div className={`h-2 w-full rounded-full ${progressAccentClass}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md pb-8 pt-4">
        <section className={`rounded-2xl border p-5 shadow-xl ${cardClass}`}>
          {loading ? (
            <p className="text-center text-sm text-gray-600">Cargando...</p>
          ) : event ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">¡Tu invitación está lista! 🎉</h1>
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

                {rsvpConfirmacionesLine ? (
                  <p className="text-sm text-gray-500">
                    Confirmaciones hasta el {rsvpConfirmacionesLine}
                  </p>
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
                <Link href={`/dashboard/events/${slug}/edit?theme=${themeKey}&from=share`} className={secondaryOutlineClass}>
                  Editar evento
                </Link>
                <a href={`/e/${event.public_slug}?preview=true`} className={secondaryOutlineClass}>
                  Ver cómo la verán tus invitados
                </a>
              </div>

              <div className="border-t border-gray-200 pt-6">
                {freeEventAvailable ? (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => {
                      console.log('modal trigger clicked')
                      setShowPaymentModal(true)
                    }}
                    className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${primaryButtonClass}`}
                  >
                    {publishing ? 'Publicando...' : 'Quiero enviar la invitación'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-2xl font-bold text-gray-900">€1.99</p>
                    <p className="text-sm text-gray-600">Pago único por evento. Sin suscripciones.</p>
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() => {
                        console.log('modal trigger clicked')
                        setShowPaymentModal(true)
                      }}
                      className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${primaryButtonClass}`}
                    >
                      {publishing ? 'Publicando...' : 'Quiero enviar la invitación — €1.99'}
                    </button>
                  </div>
                )}

                {publishError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {publishError}
                  </p>
                ) : null}
              </div>
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
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-500 text-center">✨ Ya casi está listo</p>
            <h2 id="payment-modal-title" className="mt-2 text-xl font-bold text-center text-gray-900">
              Tu invitación ya está lista 🎉
            </h2>
            <p className="mt-2 text-sm text-gray-500 text-center">
              Comparte tu invitación y empieza a recibir respuestas en tu plataforma de eventos MiParty.
            </p>
            <p className={`mt-4 text-center text-3xl font-bold ${brandClass}`}>€1.99</p>
            <p className="mt-2 text-center text-sm text-gray-600">
              Pago único por evento. Sin suscripciones.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={publishing}
                onClick={() => {
                  setShowPaymentModal(false)
                  void handlePublish()
                }}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ring-offset-2 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass} ${primaryButtonClass}`}
              >
                {publishing
                  ? 'Activando...'
                  : freeEventAvailable
                    ? 'Activar mi evento gratis'
                    : 'Activar mi evento · €1.99'}
              </button>
              <p className="mt-2 text-center text-xs text-gray-400">
                Podrás compartir el enlace y ver las respuestas al instante.
              </p>
              <button
                type="button"
                disabled={publishing}
                onClick={() => setShowPaymentModal(false)}
                className={secondaryOutlineClass}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
