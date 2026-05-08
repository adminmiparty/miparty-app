'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type EventListItem = {
  id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
}

function formatSpanishDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

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
          setLoading(false)
        }
        return
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select('id, public_slug, title, child_name, event_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (isMounted) {
        if (eventsError) {
          setError(eventsError.message)
          setEvents([])
        } else {
          setEvents((data ?? []) as EventListItem[])
        }
        setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-md md:max-w-3xl">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl md:p-6">
          <h1 className="text-xl font-bold text-gray-900">Mis eventos</h1>
          <p className="mt-1 text-sm text-gray-600">Elige un evento para ver su resumen y gestionar respuestas.</p>

          {loading ? <p className="mt-4 text-sm text-gray-500">Cargando eventos...</p> : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {!loading && !error && events.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">Aún no tienes eventos creados.</p>
              <Link
                href="/dashboard/events/new"
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
              >
                Crear primer evento
              </Link>
            </div>
          ) : null}

          {!loading && !error && events.length > 0 ? (
            <ul className="mt-4 space-y-3 md:space-y-4">
              {events.map((event) => {
                const isPast = event.event_date < todayIso
                return (
                  <li key={event.id}>
                    <Link
                      href={`/dashboard/events/${event.public_slug}`}
                      className="block w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-gray-900">{event.title}</p>
                          <p className="mt-1 text-sm text-gray-600">{`Cumple: ${event.child_name}`}</p>
                          <p className="mt-1 text-xs text-gray-500">{formatSpanishDate(event.event_date)}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            isPast ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {isPast ? 'Finalizado' : 'Próximo'}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}
