'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { getTheme } from '@/lib/themes'

type EventItem = {
  id: string
  title: string
  event_date: string
  child_name: string
}

type LatestEvent = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool'
  bizum_phone: string | null
  organizer_notes: string | null
  enable_food_options: boolean | null
  birthday_number: number | null
  rsvp_deadline_days: number | null
  invitation_theme: string | null
}

type FoodOption = {
  label: string
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatSpanishFullDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeValue(time: string) {
  return time.slice(0, 5)
}

function getGiftLabel(giftOption: LatestEvent['gift_option']) {
  if (giftOption === 'sin_regalo') {
    return 'Sin regalo'
  }
  if (giftOption === 'regalo_libre') {
    return 'Regalo libre'
  }
  return 'Regalo compartido'
}

function formatConfirmacionesHastaLabel(eventDateIso: string, daysBefore: number) {
  const [y, m, d] = eventDateIso.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(y, m - 1, d)
  const deadline = subDays(eventDay, daysBefore)
  return `Confirmaciones hasta el ${format(deadline, "EEEE, d 'de' MMMM", { locale: es })}`
}

function formatFoodOptions(options: string[]) {
  if (options.length === 0) {
    return ''
  }
  if (options.length === 1) {
    return options[0]
  }
  if (options.length === 2) {
    return `${options[0]} o ${options[1]}`
  }
  const head = options.slice(0, -1).join(', ')
  const last = options[options.length - 1]
  return `${head} o ${last}`
}

export default function EventsPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestPublicSlug, setLatestPublicSlug] = useState<string | null>(null)
  const [latestEvent, setLatestEvent] = useState<LatestEvent | null>(null)
  const [latestEventFoodOptions, setLatestEventFoodOptions] = useState<FoodOption[]>([])
  const [copied, setCopied] = useState(false)
  const theme = getTheme(latestEvent?.invitation_theme)
  const pageBgMap: Record<string, string> = {
    yellow: 'from-yellow-50 to-white',
    pink: 'from-pink-50 to-white',
    blue: 'from-blue-50 to-white',
    green: 'from-green-50 to-white',
    purple: 'from-purple-50 to-white',
  }
  const shareButtonClassMap: Record<string, string> = {
    yellow: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
    pink: 'bg-pink-400 hover:bg-pink-500 text-white',
    blue: 'bg-blue-400 hover:bg-blue-500 text-white',
    green: 'bg-green-400 hover:bg-green-500 text-white',
    purple: 'bg-purple-400 hover:bg-purple-500 text-white',
  }
  const progressAccentMap: Record<string, string> = {
    yellow: 'bg-yellow-400',
    pink: 'bg-pink-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    purple: 'bg-purple-400',
  }
  const themeKeyByLabel: Record<string, string> = {
    Amarillo: 'yellow',
    Rosa: 'pink',
    Azul: 'blue',
    Verde: 'green',
    Lila: 'purple',
  }
  const resolvedThemeKey = latestEvent?.invitation_theme ?? themeKeyByLabel[theme.label] ?? 'yellow'
  const pageBg = pageBgMap[resolvedThemeKey] ?? pageBgMap.yellow
  const shareButtonClass = shareButtonClassMap[resolvedThemeKey] ?? shareButtonClassMap.yellow
  const progressAccentClass = progressAccentMap[resolvedThemeKey] ?? progressAccentMap.yellow

  useEffect(() => {
    let isMounted = true

    const loadEvents = async () => {
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
        .select('id, title, event_date, child_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: latestEvent } = await supabase
        .from('events')
        .select(
          'id, public_slug, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, organizer_notes, enable_food_options, birthday_number, rsvp_deadline_days, invitation_theme'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let latestFoodOptions: FoodOption[] = []
      if (latestEvent?.enable_food_options) {
        const { data: foodOptions } = await supabase
          .from('event_food_options')
          .select('label')
          .eq('event_id', latestEvent.id)
          .order('created_at', { ascending: true })
        console.log('latest event food options', {
          latestEventId: latestEvent.id,
          enableFoodOptions: latestEvent.enable_food_options,
          foodOptions,
        })
        latestFoodOptions = (foodOptions ?? []) as FoodOption[]
      }

      if (isMounted) {
        if (eventsError) {
          setError(eventsError.message)
          setEvents([])
        } else {
          setEvents((data ?? []) as EventItem[])
          setLatestPublicSlug(latestEvent?.public_slug ?? null)
          setLatestEvent((latestEvent as LatestEvent | null) ?? null)
          setLatestEventFoodOptions(latestFoodOptions)
        }
        setLoading(false)
      }
    }

    void loadEvents()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const handleCopyLink = async () => {
    if (!latestPublicSlug) {
      return
    }
    await navigator.clipboard.writeText(`miparty.net/e/${latestPublicSlug}`)
    setCopied(true)
    window.setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  const handleShareInvitation = async () => {
    if (!latestEvent?.public_slug) {
      return
    }

    const shareUrl = `https://miparty.net/e/${latestEvent.public_slug}`
    const shareText = `¡Hola! Te comparto la invitación al cumple de ${latestEvent.child_name} 🎉\nAquí puedes ver los detalles y confirmar asistencia:`

    if (navigator.share) {
      await navigator.share({
        title: latestEvent.title,
        text: shareText,
        url: shareUrl,
      })
      return
    }

    const whatsappText = `${shareText}\n ${shareUrl}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 rounded-xl border border-yellow-100 bg-white/80 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Paso 2 de 2 — Compartir invitación</span>
          </div>
          <div className="h-2 w-full rounded-full bg-yellow-100">
            <div className={`h-2 w-full rounded-full ${progressAccentClass}`} />
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900">Tu invitación está lista 🎉</h1>
          <p className="mt-2 text-sm text-gray-600">Ya puedes copiar y compartir tu invitación.</p>

          {latestEvent ? (
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="text-lg font-bold text-gray-900">{latestEvent.title}</p>
              <p className="text-gray-700">{`📅 ${capitalizeFirst(formatSpanishFullDate(latestEvent.event_date))}`}</p>
              {latestEvent.rsvp_deadline_days != null &&
              latestEvent.rsvp_deadline_days > 0 &&
              Number.isFinite(latestEvent.rsvp_deadline_days) ? (
                <p className="text-sm text-gray-500">
                  {formatConfirmacionesHastaLabel(latestEvent.event_date, latestEvent.rsvp_deadline_days)}
                </p>
              ) : null}
              <p className="text-gray-700">
                {latestEvent.pickup_time
                  ? `🕒 ${formatTimeValue(latestEvent.start_time)} a ${formatTimeValue(latestEvent.pickup_time)}`
                  : `🕒 A las ${formatTimeValue(latestEvent.start_time)}`}
              </p>
              {latestEvent.google_maps_url ? (
                <>
                  <a
                    href={latestEvent.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block no-underline"
                  >
                    <p className="text-gray-700">{`📍 ${latestEvent.location_name ?? 'ubicación'}`}</p>
                    <p className="pl-6 text-sm text-gray-500">{latestEvent.location_address ?? ''}</p>
                  </a>
                  <a
                    href={latestEvent.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block pl-6 text-xs text-gray-400 no-underline"
                  >
                    Ver en Google Maps ↗
                  </a>
                </>
              ) : (
                <div>
                  <p className="text-gray-700">{`📍 ${latestEvent.location_name ?? 'ubicación'}`}</p>
                  <p className="pl-6 text-sm text-gray-500">{latestEvent.location_address ?? ''}</p>
                </div>
              )}
              <p className="text-gray-700">
                {latestEvent.gift_option === 'regalo_libre'
                  ? '🎁 Regalo libre'
                  : latestEvent.gift_option === 'bizum_pool' && latestEvent.bizum_phone
                    ? latestEvent.bizum_phone.startsWith('+34')
                      ? `🎁 Hucha al móvil ${latestEvent.bizum_phone.replace(/^\+\d{2}/, '')} (Bizum)`
                      : latestEvent.bizum_phone.startsWith('+57')
                        ? `🎁 Nequi al ${latestEvent.bizum_phone.replace(/^\+\d{2}/, '')}`
                        : `🎁 ${getGiftLabel(latestEvent.gift_option)}`
                    : `🎁 ${getGiftLabel(latestEvent.gift_option)}`}
              </p>
              {latestEvent.enable_food_options && latestEventFoodOptions.length > 0 ? (
                <p className="text-gray-700">
                  {`🍽️ ${formatFoodOptions(latestEventFoodOptions.map((option) => option.label))}`}
                </p>
              ) : null}
              {latestEvent.organizer_notes ? (
                <div>
                  <p className="text-gray-700">📓 Mensaje para los invitados</p>
                  <p className="mt-2 text-sm text-gray-400 italic">{latestEvent.organizer_notes}</p>
                </div>
              ) : null}
              <Link
                href={`/dashboard/events/${latestEvent.id}/edit`}
                className="mt-2 inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-normal text-gray-800 transition hover:bg-gray-50"
              >
                Editar evento
              </Link>
            </div>
          ) : null}

          {latestPublicSlug ? (
            <div className="mt-4 rounded-lg border border-yellow-100 bg-yellow-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Enlace para compartir</p>
              <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-white px-2 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-gray-900">{`miparty.net/e/${latestPublicSlug}`}</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copiar enlace"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-base text-gray-700 transition hover:bg-gray-50"
                >
                  📋
                </button>
              </div>
              <Link
                href={`/e/${latestPublicSlug}?preview=true`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                Ver invitación
              </Link>
              <button
                type="button"
                onClick={handleShareInvitation}
                className={`mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition ${shareButtonClass}`}
              >
                Compartir invitación
              </button>
              {copied ? <p className="mt-2 text-xs text-gray-600">Enlace copiado</p> : null}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="#mis-eventos"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              Ver mis eventos
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              Volver al panel
            </Link>
          </div>
        </section>

        <section id="mis-eventos" className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
          <h2 className="text-base font-semibold text-gray-900">Todos mis eventos</h2>

          {loading ? <p className="mt-3 text-sm text-gray-500">Cargando eventos...</p> : null}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {!loading && !error && events.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Aún no tienes eventos guardados.</p>
          ) : null}

          {!loading && !error && events.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Cumple: {event.child_name} · Fecha: {formatSpanishFullDate(event.event_date)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}
