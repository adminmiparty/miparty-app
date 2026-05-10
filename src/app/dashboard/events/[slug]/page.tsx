'use client'

import Link from 'next/link'
import { Copy, LayoutGrid, Table2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ShareButton from '@/components/ShareButton'

type EventDetails = {
  id: string
  user_id: string
  public_slug: string
  title: string
  child_name: string
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  enable_food_options: boolean | null
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
  attendance_status: 'confirmed' | 'declined' | 'maybe' | null
  food_preference: string | null
  allergy_notes: string | null
  extra_notes: string | null
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

export default function EventControlCenterPage() {
  const params = useParams()
  const router = useRouter()
  const slug =
    typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? (params.slug[0] ?? '') : ''

  const [event, setEvent] = useState<EventDetails | null>(null)
  const [rsvps, setRsvps] = useState<RsvpItem[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [activeFilters, setActiveFilters] = useState<string[]>(['confirmed', 'declined', 'maybe'])
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const copyInviteLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    }
  }, [])

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
          'id, user_id, public_slug, title, child_name, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, enable_food_options, invitation_theme, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom'
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

      const { data: rsvpRows } = await supabase
        .from('rsvps')
        .select(
          'id, child_name, guest_parent_name, attendance_status, food_preference, allergy_notes, extra_notes'
        )
        .eq('event_id', eventRow.id)
        .order('created_at', { ascending: false })

      if (cancelled) {
        return
      }

      setEvent(eventRow)
      setRsvps((rsvpRows ?? []) as RsvpItem[])
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug, router])

  const confirmedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'confirmed').length
  const declinedCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'declined').length
  const maybeCount = rsvps.filter((rsvp) => rsvp.attendance_status === 'maybe').length
  const pendingCount = 0

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

  const filteredRsvps = useMemo(
    () =>
      activeFilters.length === 0
        ? rsvps
        : rsvps.filter((r) => activeFilters.includes(r.attendance_status ?? 'pending')),
    [rsvps, activeFilters]
  )

  const showDemoLucía = activeFilters.length === 0 || activeFilters.includes('confirmed')
  const showDemoCarlos = activeFilters.length === 0 || activeFilters.includes('maybe')
  const showDemoEmma = activeFilters.length === 0 || activeFilters.includes('declined')
  const anyDemoRowVisible = showDemoLucía || showDemoCarlos || showDemoEmma

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
      rsvps
        .filter((rsvp) => (rsvp.allergy_notes ?? '').trim() !== '')
        .map((rsvp) => ({
          childName: rsvp.child_name.trim(),
          note: (rsvp.allergy_notes ?? '').trim(),
        })),
    [rsvps]
  )

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
  const pageBg = pageBgMap[themeKey] ?? pageBgMap.yellow
  const primaryButtonClass = buttonMap[themeKey] ?? buttonMap.yellow
  const accentBorderClass = accentBorderMap[themeKey] ?? accentBorderMap.yellow
  const accentSoftBgClass = accentSoftBgMap[themeKey] ?? accentSoftBgMap.yellow
  const accentTextClass = accentTextMap[themeKey] ?? accentTextMap.yellow

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
      </div>
    </div>
  )

  if (loading) return null

  if (loadError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
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
      <div className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 md:max-w-6xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            ← Mis eventos
          </Link>
          <p className="text-sm font-bold text-yellow-500">MiParty</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_minmax(0,1fr)] md:gap-6">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl md:sticky md:top-6 md:self-start">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  isEventUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isEventUpcoming ? '🟢 Próximo' : '⚫ Finalizado'}
              </span>
              <h1 className="mt-3 text-2xl font-bold text-gray-900">Resumen del evento</h1>
              <p className="mt-1 text-sm text-gray-600">{event.title}</p>
              <p className="mt-2 text-sm text-gray-700">{`📅 ${formatSpanishFullDate(event.event_date)}`}</p>
              <p className="text-sm text-gray-700">
                {event.pickup_time
                  ? `🕒 ${formatTimeValue(event.start_time)} a ${formatTimeValue(event.pickup_time)}`
                  : `🕒 A las ${formatTimeValue(event.start_time)}`}
              </p>

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

              <div className="mt-4">
                <Link
                  href={`/dashboard/events/${event.public_slug}/edit?theme=${event.invitation_theme ?? 'yellow'}`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Editar evento
                </Link>
              </div>

              <div className="mt-4">
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
            </section>
          </aside>

          <div className="w-full space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
              <div className="mx-auto grid w-full grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => toggleFilter('confirmed')}
                  className={`cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition hover:shadow ${
                    activeFilters.includes('confirmed')
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
                  className={`cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition hover:shadow ${
                    activeFilters.includes('declined')
                      ? `opacity-100 ring-2 ring-offset-2 ring-offset-white ${statRingActiveClass} shadow-md`
                      : 'opacity-50'
                  }`}
                >
                  <p className="text-xs text-gray-600">❌ No pueden</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{declinedCount}</p>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('maybe')}
                  className={`cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition hover:shadow ${
                    activeFilters.includes('maybe')
                      ? `opacity-100 ring-2 ring-offset-2 ring-offset-white ${statRingActiveClass} shadow-md`
                      : 'opacity-50'
                  }`}
                >
                  <p className="text-xs text-gray-600">🤔 Aún no saben</p>
                  <p className={`mt-1 text-2xl font-bold ${accentTextClass}`}>{maybeCount}</p>
                </button>
              </div>
              {rsvps.length === 0 ? (
                <>
                  {responsesSectionHeader}
                  <p className="mb-2 mt-1 text-left text-xs text-gray-400">Así se verán las respuestas</p>
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
                                  <p className="text-xs text-gray-500">Adulto: María Pérez</p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                  ✅ Sí
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-gray-500">🍕 Pizza</p>
                              <p className="mt-1 rounded-lg bg-gray-100/80 px-2 py-1 text-sm italic text-gray-500">
                                💬 ¡Qué ilusión, gracias por invitarnos!
                              </p>
                            </article>
                          ) : null}
                          {showDemoCarlos ? (
                            <article className="pointer-events-none rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 opacity-70">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-500">Carlos Díaz</p>
                                  <p className="text-xs text-gray-500">Adulto: Roberto Díaz</p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                  🤔 Aún no lo sé
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-gray-500">🌭 Perrito</p>
                              <p className="mt-1 text-sm text-gray-500">⚠️ Gluten</p>
                            </article>
                          ) : null}
                          {showDemoEmma ? (
                            <article className="pointer-events-none rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 opacity-70">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-500">Emma García</p>
                                  <p className="text-xs text-gray-500">Adulto: Laura García</p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                                  ❌ No puede ir
                                </span>
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
                              <th className="whitespace-nowrap px-3 py-2">Niño/a</th>
                              <th className="whitespace-nowrap px-3 py-2">Adulto</th>
                              <th className="whitespace-nowrap px-3 py-2">Estado</th>
                              <th className="whitespace-nowrap px-3 py-2">Comida</th>
                              <th className="whitespace-nowrap px-3 py-2">Alergias</th>
                              <th className="whitespace-nowrap px-3 py-2 min-w-[120px]">Mensaje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!anyDemoRowVisible ? (
                              <tr>
                                <td colSpan={6} className="whitespace-nowrap px-3 py-4 text-center text-sm text-gray-600">
                                  No hay respuestas con estos filtros.
                                </td>
                              </tr>
                            ) : (
                              <>
                                {showDemoLucía ? (
                                  <tr className="border-b border-gray-100 bg-gray-50 italic text-gray-400 opacity-70">
                                    <td className="whitespace-nowrap px-3 py-2 font-medium">Lucía Pérez</td>
                                    <td className="whitespace-nowrap px-3 py-2" title="María Pérez">
                                      María Pérez
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">
                                        ✅ Sí
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2" title="🍕 Pizza">
                                      🍕 Pizza
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
                                    <td className="whitespace-nowrap px-3 py-2 min-w-[120px] text-gray-700" title="¡Qué ilusión, gracias por invitarnos!">
                                      ¡Qué ilusión, gracias por invitarnos!
                                    </td>
                                  </tr>
                                ) : null}
                                {showDemoCarlos ? (
                                  <tr className="border-b border-gray-100 bg-gray-50 italic text-gray-400 opacity-70">
                                    <td className="whitespace-nowrap px-3 py-2 font-medium">Carlos Díaz</td>
                                    <td className="whitespace-nowrap px-3 py-2" title="Roberto Díaz">
                                      Roberto Díaz
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">
                                        🤔 Aún no lo sé
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2" title="🌭 Perrito">
                                      🌭 Perrito
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2" title="Gluten">
                                      Gluten
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
                                  </tr>
                                ) : null}
                                {showDemoEmma ? (
                                  <tr className="border-b border-gray-100 bg-gray-50 italic text-gray-400 opacity-70">
                                    <td className="whitespace-nowrap px-3 py-2 font-medium">Emma García</td>
                                    <td className="whitespace-nowrap px-3 py-2" title="Laura García">
                                      Laura García
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                      <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">
                                        ❌ No puede ir
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-gray-400">—</td>
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
                          return (
                            <article key={rsvp.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{fullChildName}</p>
                                  <p className="text-xs text-gray-500">Adulto: {rsvp.guest_parent_name}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${status.badge}`}>
                                  {status.label}
                                </span>
                              </div>
                              {rsvp.food_preference ? (
                                <p className="mt-2 text-sm text-gray-700">{`🍽️ ${rsvp.food_preference}`}</p>
                              ) : null}
                              {rsvp.allergy_notes ? (
                                <p className="mt-1 text-sm text-gray-700">{`⚠️ ${rsvp.allergy_notes}`}</p>
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
                        <thead>
                          <tr className="border-b border-gray-200 text-xs font-medium text-gray-600">
                            <th className="whitespace-nowrap px-3 py-2">Niño/a</th>
                            <th className="whitespace-nowrap px-3 py-2">Adulto</th>
                            <th className="whitespace-nowrap px-3 py-2">Estado</th>
                            <th className="whitespace-nowrap px-3 py-2">Comida</th>
                            <th className="whitespace-nowrap px-3 py-2">Alergias</th>
                            <th className="whitespace-nowrap px-3 py-2 min-w-[120px]">Mensaje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRsvps.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="whitespace-nowrap px-3 py-4 text-center text-sm text-gray-600">
                                No hay respuestas con estos filtros.
                              </td>
                            </tr>
                          ) : (
                            filteredRsvps.map((rsvp) => {
                            const status = rsvpStatusMeta(rsvp.attendance_status)
                            const fullChildName = rsvp.child_name.trim()
                            const foodRaw = (rsvp.food_preference ?? '').trim()
                            const foodDisplay = foodRaw ? `🍽️ ${foodRaw}` : ''
                            const allergyRaw = (rsvp.allergy_notes ?? '').trim()
                            const messageRaw = (rsvp.extra_notes ?? '').trim()
                            return (
                              <tr key={rsvp.id} className="border-b border-gray-100">
                                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{fullChildName}</td>
                                <td
                                  className="whitespace-nowrap px-3 py-2 text-gray-700"
                                  title={rsvp.guest_parent_name || undefined}
                                >
                                  {rsvp.guest_parent_name}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <span
                                    className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${status.badge}`}
                                  >
                                    {status.label}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-gray-700" title={foodDisplay || undefined}>
                                  {foodRaw ? (
                                    foodDisplay
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-gray-700" title={allergyRaw || undefined}>
                                  {allergyRaw ? allergyRaw : <span className="text-gray-300">—</span>}
                                </td>
                                <td
                                  className="whitespace-nowrap px-3 py-2 min-w-[120px] text-gray-700"
                                  title={messageRaw || undefined}
                                >
                                  {messageRaw ? messageRaw : <span className="text-gray-300">—</span>}
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

            {event.enable_food_options && foodPreferenceCounts.length > 0 ? (
              <section className={`rounded-2xl border shadow-xl ${accentBorderClass} ${accentSoftBgClass}`}>
                <div className="px-6 py-4">
                  <h2 className="text-left text-base font-semibold text-gray-900">🍽️ Resumen de comida</h2>
                  <div className="mt-3 space-y-2.5 text-left text-sm leading-relaxed text-gray-700">
                    {foodPreferenceCounts.map((item) => (
                      <p key={item.label}>{`${item.label} → ${item.count}`}</p>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {allergyEntries.length > 0 ? (
              <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl">
                <h2 className="text-base font-semibold text-amber-900">⚠️ Alergias e intolerancias</h2>
                <div className="mt-2 space-y-1 text-sm text-amber-900">
                  {allergyEntries.map((entry, index) => (
                    <p key={`${entry.childName}-${index}`}>{`${entry.childName}: ${entry.note}`}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
