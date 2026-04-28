'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  gift_option: 'sin_regalo' | 'regalo_libre' | 'bizum_pool'
  bizum_phone: string | null
  organizer_notes: string | null
  enable_food_options: boolean | null
}

type FoodOption = {
  label: string
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
  return 'Regalo en grupo'
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
          'id, public_slug, title, child_name, event_date, start_time, pickup_time, location_name, gift_option, bizum_phone, organizer_notes, enable_food_options'
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 rounded-xl border border-yellow-100 bg-white/80 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Paso 2 de 2 — Compartir invitación</span>
          </div>
          <div className="h-2 w-full rounded-full bg-yellow-100">
            <div className="h-2 w-full rounded-full bg-yellow-400" />
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900">Tu invitación está lista 🎉</h1>
          <p className="mt-2 text-sm text-gray-600">Ya puedes copiar y compartir tu invitación.</p>

          {latestEvent ? (
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="text-lg font-bold text-gray-900">{latestEvent.title}</p>
              <p className="text-gray-700">{`El ${formatSpanishFullDate(latestEvent.event_date)}`}</p>
              <p className="text-gray-700">
                {latestEvent.pickup_time
                  ? `De ${formatTimeValue(latestEvent.start_time)} a ${formatTimeValue(latestEvent.pickup_time)}`
                  : `A las ${formatTimeValue(latestEvent.start_time)}`}
              </p>
              <p className="text-gray-700">
                En {latestEvent.location_name ?? 'ubicación'}
              </p>
              <p className="text-gray-700">
                {latestEvent.gift_option === 'bizum_pool' && latestEvent.bizum_phone
                  ? `Regalo en grupo: ${latestEvent.bizum_phone}`
                  : getGiftLabel(latestEvent.gift_option)}
              </p>
              {latestEvent.enable_food_options && latestEventFoodOptions.length > 0 ? (
                <p className="text-gray-700">
                  {`Opciones de comida: ${latestEventFoodOptions.map((option) => option.label).join(', ')}`}
                </p>
              ) : null}
              {latestEvent.organizer_notes ? (
                <p className="text-gray-500 italic">{latestEvent.organizer_notes}</p>
              ) : null}
              <Link
                href={`/dashboard/events/${latestEvent.id}/edit`}
                className="mt-2 inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Editar evento
              </Link>
            </div>
          ) : null}

          {latestPublicSlug ? (
            <div className="mt-4 rounded-lg border border-yellow-100 bg-yellow-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Enlace para compartir</p>
              <div className="rounded-md border border-yellow-200 bg-white px-3 py-2 text-sm text-gray-900">
                {`miparty.net/e/${latestPublicSlug}`}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 inline-flex items-center justify-center rounded-lg bg-yellow-400 px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
              >
                {copied ? 'Enlace copiado' : 'Copiar enlace'}
              </button>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="#mis-eventos"
              className="inline-flex items-center justify-center rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
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
