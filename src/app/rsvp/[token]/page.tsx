'use client'

import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTheme } from '@/lib/themes'

type AttendanceStatus = 'confirmed' | 'declined' | 'maybe'

type LoadedEventForEdit = {
  id: string
  title: string
  child_name: string
  birthday_number: number | null
  event_date: string
  start_time: string
  pickup_time: string | null
  location_name: string | null
  location_address: string | null
  google_maps_url: string | null
  gift_option: string | null
  bizum_phone: string | null
  invitation_theme: string | null
  enable_food_options: boolean | null
  organizer_notes: string | null
  rsvp_deadline_days: number | null
  public_slug: string | null
  invitation_image_url: string | null
  invitation_image_fit: string | null
  invitation_image_position: string | null
  invitation_image_zoom: number | null
}

type NormalizedRsvpPayload = {
  attendance_status: AttendanceStatus
  guest_parent_name: string
  guest_parent_email: string | null
  guest_parent_phone: string | null
  child_name: string
  food_preference: string | null
  allergy_notes: string | null
  extra_notes: string | null
}

type ThemeKeyType = 'yellow' | 'pink' | 'blue' | 'green' | 'purple'

const statusSummaryLabels: Record<AttendanceStatus, string> = {
  confirmed: 'Confirmado',
  declined: 'No puede',
  maybe: 'Aún no sabe',
}

const inputFocusMap: Record<ThemeKeyType, string> = {
  yellow: 'ring-yellow-400 focus:border-yellow-400',
  pink: 'ring-pink-400 focus:border-pink-400',
  blue: 'ring-blue-400 focus:border-blue-400',
  green: 'ring-green-400 focus:border-green-400',
  purple: 'ring-purple-400 focus:border-purple-400',
}

const previewBrandMap: Record<ThemeKeyType, string> = {
  yellow: 'text-yellow-500',
  pink: 'text-pink-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
  purple: 'text-purple-500',
}

function sanitizeDialPrefix(raw: string): string {
  const digitsPlus = raw.replace(/[^\d+]/g, '')
  if (digitsPlus.length === 0) return ''
  let body = digitsPlus.startsWith('+') ? digitsPlus.slice(1) : digitsPlus
  body = body.replace(/\+/g, '')
  return ('+' + body).slice(0, 5)
}

function resolveDialCode(countryCode: string, customCode: string): string {
  return countryCode === 'otro' ? sanitizeDialPrefix(customCode) : countryCode
}

function dialCodeShortLabel(code: string): string {
  if (code === '+57') return '🇨🇴 +57'
  if (code === 'otro') return '✏️ Otro'
  return '🇪🇸 +34'
}

function splitGuestPhone(full: string | null): {
  countryCode: '+34' | '+57' | 'otro'
  customCode: string
  number: string
} {
  if (!full?.trim()) return { countryCode: '+34', customCode: '', number: '' }
  const t = full.trim()
  if (t.startsWith('+57')) return { countryCode: '+57', customCode: '', number: t.slice(3) }
  if (t.startsWith('+34')) return { countryCode: '+34', customCode: '', number: t.slice(3) }
  const match = t.match(/^(\+\d{1,5})(\d[\d\s]*)$/)
  if (match && match[1].length <= 5) {
    return { countryCode: 'otro', customCode: match[1], number: match[2].replace(/\s/g, '') }
  }
  return { countryCode: 'otro', customCode: '', number: t.replace(/^\+/, '') }
}

function splitChildNameForForm(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] ?? '' }
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatSpanishFullDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  const raw = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return capitalizeFirst(raw)
}

function formatRsvpDeadlineLabel(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return capitalizeFirst(format(deadline, "EEEE, d 'de' MMMM", { locale: es }))
}

function formatTimeValue(time: string) {
  return time.slice(0, 5)
}

function getGiftLine(giftOption: string | null, bizumPhone: string | null) {
  if (giftOption == null) return null
  if (giftOption === 'regalo_libre') return '🎁 Regalo libre'
  if (bizumPhone?.startsWith('+34')) return `🎁 Hucha al móvil ${bizumPhone.replace(/^\+\d{2}/, '')} (Bizum)`
  if (bizumPhone?.startsWith('+57')) return `🎁 Nequi al ${bizumPhone.replace(/^\+\d{2}/, '')}`
  return '🎁 Regalo compartido'
}

function buildNormalizedPayloadFromForm(params: {
  attendance: AttendanceStatus
  childName: string
  childLastName: string
  parentName: string
  parentEmail: string
  parentCountryCode: string
  parentCustomCode: string
  parentPhoneNumber: string
  foodPreference: string
  allergyNotes: string
  extraNotes: string
  hasFoodOptions: boolean
}): NormalizedRsvpPayload {
  const trimmedParentName = params.parentName.trim()
  const trimmedChildName = params.childName.trim()
  const trimmedChildLastName = params.childLastName.trim()
  const trimmedParentEmail = params.parentEmail.trim()
  const trimmedParentPhoneNumber = params.parentPhoneNumber.trim()
  const finalParentDial = resolveDialCode(params.parentCountryCode, params.parentCustomCode)
  const trimmedParentPhone =
    trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''
  const combinedChildName =
    trimmedChildLastName.length > 0 ? `${trimmedChildName} ${trimmedChildLastName}` : trimmedChildName
  const trimmedFoodPreference = params.foodPreference.trim()
  const trimmedAllergyNotes = params.allergyNotes.trim()
  const trimmedExtraNotes = params.extraNotes.trim()
  const { attendance, hasFoodOptions } = params
  return {
    attendance_status: attendance,
    guest_parent_name: trimmedParentName,
    guest_parent_email: trimmedParentEmail || null,
    guest_parent_phone: trimmedParentPhone || null,
    child_name: combinedChildName,
    food_preference: attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null,
    allergy_notes: attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null,
    extra_notes: trimmedExtraNotes || null,
  }
}

function buildBaselinePayload(
  rsvpData: {
    attendance_status: string | null
    guest_parent_name: string | null
    guest_parent_email: string | null
    guest_parent_phone: string | null
    child_name: string | null
    food_preference: string | null
    allergy_notes: string | null
    extra_notes: string | null
  },
  hasFoodOptions: boolean,
  opts: { label: string }[],
): NormalizedRsvpPayload | null {
  const status = rsvpData.attendance_status
  if (status !== 'confirmed' && status !== 'declined' && status !== 'maybe') return null
  let foodPref = rsvpData.food_preference?.trim() || null
  if (status === 'confirmed' && hasFoodOptions && opts.length === 1 && !foodPref) {
    foodPref = opts[0]?.label ?? null
  }
  const childFull = (rsvpData.child_name ?? '').trim()
  const phone = (rsvpData.guest_parent_phone ?? '').trim() || null
  return {
    attendance_status: status,
    guest_parent_name: (rsvpData.guest_parent_name ?? '').trim(),
    guest_parent_email: (rsvpData.guest_parent_email ?? '').trim() || null,
    guest_parent_phone: phone,
    child_name: childFull,
    food_preference: status === 'confirmed' && hasFoodOptions ? foodPref : null,
    allergy_notes: status === 'confirmed' && hasFoodOptions ? rsvpData.allergy_notes?.trim() || null : null,
    extra_notes: rsvpData.extra_notes?.trim() || null,
  }
}

export default function RsvpEditPage() {
  const params = useParams()
  const token =
    typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? (params.token[0] ?? '') : ''

  const supabase = createClient()

  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready' | 'notfound'>('loading')
  const [themeKey, setThemeKey] = useState<string | null>('yellow')
  const [eventData, setEventData] = useState<LoadedEventForEdit | null>(null)
  const [baselinePayload, setBaselinePayload] = useState<NormalizedRsvpPayload | null>(null)
  const [loadedResponseSummary, setLoadedResponseSummary] = useState<{
    attendance: AttendanceStatus
    childDisplayName: string
  } | null>(null)
  const [foodOptions, setFoodOptions] = useState<{ label: string }[]>([])
  const [hasFoodOptions, setHasFoodOptions] = useState(false)

  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null)
  const [childName, setChildName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentCountryCode, setParentCountryCode] = useState<string>('+34')
  const [parentCustomCode, setParentCustomCode] = useState('')
  const [parentPhoneNumber, setParentPhoneNumber] = useState('')
  const [foodPreference, setFoodPreference] = useState('')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [extraNotes, setExtraNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedStatus, setSubmittedStatus] = useState<AttendanceStatus | null>(null)
  const [copyEditLinkDone, setCopyEditLinkDone] = useState(false)
  const copyEditLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [parentDialOpen, setParentDialOpen] = useState(false)
  const parentDialRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  const resolvedThemeKey: ThemeKeyType =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const activeTheme = getTheme(resolvedThemeKey)
  const inputFocusClass = inputFocusMap[resolvedThemeKey]

  const editLinkIntroCopy: Record<AttendanceStatus, string> = {
    confirmed: 'Guarda este enlace por si necesitas cambiar tu respuesta más tarde:',
    declined: 'Guarda este enlace por si cambias de opinión:',
    maybe: 'Usa este enlace para confirmar tu asistencia cuando lo tengas claro:',
  }

  useEffect(() => {
    if (!parentDialOpen) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (parentDialRef.current?.contains(target)) return
      setParentDialOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [parentDialOpen])

  useEffect(() => {
    return () => {
      if (copyEditLinkTimeoutRef.current != null) clearTimeout(copyEditLinkTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setLoadState('notfound')
      return
    }

    let cancelled = false

    const load = async () => {
      setLoadState('loading')
      const { data: rsvpData, error: fetchError } = await supabase
        .from('rsvps')
        .select('*')
        .eq('edit_token', token)
        .maybeSingle()

      if (cancelled) return

      if (fetchError || !rsvpData) {
        setLoadState('notfound')
        return
      }

      const { data: eventRow } = await supabase
        .from('events')
        .select(
          'id, title, child_name, birthday_number, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, invitation_theme, enable_food_options, organizer_notes, rsvp_deadline_days, public_slug, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom'
        )
        .eq('id', rsvpData.event_id)
        .maybeSingle()

      if (cancelled) return

      if (!eventRow?.id) {
        setLoadState('notfound')
        return
      }

      const ev = eventRow as LoadedEventForEdit
      setEventData(ev)
      setThemeKey(ev.invitation_theme)
      setHasFoodOptions(Boolean(ev.enable_food_options))

      let optsList: { label: string }[] = []
      if (ev.enable_food_options) {
        const { data: opts } = await supabase
          .from('event_food_options')
          .select('label')
          .eq('event_id', ev.id)
          .order('sort_order', { ascending: true })
        optsList = (opts ?? []) as { label: string }[]
        if (!cancelled) setFoodOptions(optsList)
      } else if (!cancelled) {
        setFoodOptions([])
      }

      if (cancelled) return

      const { first, last } = splitChildNameForForm(rsvpData.child_name ?? '')
      setChildName(first)
      setChildLastName(last)
      setParentName(rsvpData.guest_parent_name ?? '')
      setParentEmail(rsvpData.guest_parent_email ?? '')
      const dial = splitGuestPhone(rsvpData.guest_parent_phone)
      setParentCountryCode(dial.countryCode)
      setParentCustomCode(dial.customCode)
      setParentPhoneNumber(dial.number)
      const status = rsvpData.attendance_status
      if (status === 'confirmed' || status === 'declined' || status === 'maybe') {
        setAttendance(status)
        setLoadedResponseSummary({
          attendance: status,
          childDisplayName: (rsvpData.child_name ?? '').trim(),
        })
      } else {
        setLoadedResponseSummary(null)
      }

      let initialFoodPref = rsvpData.food_preference?.trim() ?? ''
      if (status === 'confirmed' && Boolean(ev.enable_food_options) && optsList.length === 1 && !initialFoodPref) {
        initialFoodPref = optsList[0]?.label ?? ''
      }
      setFoodPreference(initialFoodPref)
      setAllergyNotes(rsvpData.allergy_notes?.trim() ?? '')
      setExtraNotes(rsvpData.extra_notes?.trim() ?? '')

      if (!cancelled) {
        setBaselinePayload(buildBaselinePayload(rsvpData, Boolean(ev.enable_food_options), optsList))
      }

      if (!cancelled) setLoadState('ready')
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [token, supabase])

  useEffect(() => {
    if (attendance !== 'confirmed') {
      setFoodPreference('')
      return
    }
    if (hasFoodOptions && foodOptions.length === 1) {
      setFoodPreference((prev) => (prev.trim() ? prev : foodOptions[0]?.label ?? ''))
    }
  }, [attendance, hasFoodOptions, foodOptions])

  useEffect(() => {
    if (loadState !== 'ready' || !messageRef.current) return
    const el = messageRef.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [loadState, extraNotes])

  const submitText = useMemo(() => {
    if (attendance === 'confirmed') return 'Guardar confirmación'
    if (attendance === 'declined') return 'Guardar respuesta'
    if (attendance === 'maybe') return 'Guardar como pendiente'
    return 'Guardar cambios'
  }, [attendance])

  const placeholderText = useMemo(() => {
    if (attendance === 'confirmed') return 'Ej. ¡Genial! Irá encantado/a'
    if (attendance === 'declined') return 'Ej. Lo siento, esta vez no podremos ir'
    return 'Ej. Tengo que mirarlo y te confirmo en cuanto pueda'
  }, [attendance])

  const hasFormChanges = useMemo(() => {
    if (!baselinePayload) return false
    if (!attendance) return true
    const current = buildNormalizedPayloadFromForm({
      attendance,
      childName,
      childLastName,
      parentName,
      parentEmail,
      parentCountryCode,
      parentCustomCode,
      parentPhoneNumber,
      foodPreference,
      allergyNotes,
      extraNotes,
      hasFoodOptions,
    })
    return JSON.stringify(current) !== JSON.stringify(baselinePayload)
  }, [
    baselinePayload,
    attendance,
    childName,
    childLastName,
    parentName,
    parentEmail,
    parentCountryCode,
    parentCustomCode,
    parentPhoneNumber,
    foodPreference,
    allergyNotes,
    extraNotes,
    hasFoodOptions,
  ])

  const recapHeadline = useMemo(() => {
    if (!eventData) return ''
    const bn = eventData.birthday_number
    if (bn != null && bn > 0 && Number.isFinite(bn)) {
      return `¡${eventData.child_name} cumple ${bn} años y estás invitado/a! 🎉`
    }
    return `¡Estás invitado/a al ${eventData.title}! 🎉`
  }, [eventData])

  const rsvpDeadlineLabel = useMemo(() => {
    if (!eventData) return null
    const d = eventData.rsvp_deadline_days
    if (d == null || d <= 0 || !Number.isFinite(d)) return null
    return formatRsvpDeadlineLabel(eventData.event_date, d)
  }, [eventData])

  const giftLine = useMemo(
    () => getGiftLine(eventData?.gift_option ?? null, eventData?.bizum_phone ?? null),
    [eventData],
  )

  function handleMessageInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    setExtraNotes(e.target.value)
  }

  const handleAttendanceSelect = (nextStatus: AttendanceStatus) => {
    const shouldDeselect = attendance === nextStatus
    setAttendance(shouldDeselect ? null : nextStatus)
  }

  const copyEditLinkToClipboard = async () => {
    if (!token) return
    const url = `https://miparty.net/rsvp/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyEditLinkDone(true)
      if (copyEditLinkTimeoutRef.current != null) clearTimeout(copyEditLinkTimeoutRef.current)
      copyEditLinkTimeoutRef.current = setTimeout(() => {
        setCopyEditLinkDone(false)
        copyEditLinkTimeoutRef.current = null
      }, 2000)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!attendance) return
    setError(null)

    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    if (attendance === 'confirmed' && parentCountryCode === 'otro' && finalParentDial.length <= 1) {
      setError('Indica el prefijo internacional (ej. +44).')
      return
    }

    const payload = buildNormalizedPayloadFromForm({
      attendance,
      childName,
      childLastName,
      parentName,
      parentEmail,
      parentCountryCode,
      parentCustomCode,
      parentPhoneNumber,
      foodPreference,
      allergyNotes,
      extraNotes,
      hasFoodOptions,
    })

    if (!payload.guest_parent_name) {
      setError('El nombre del padre/madre es obligatorio.')
      return
    }
    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    if (!trimmedChildName) {
      setError('El nombre del niño/a es obligatorio.')
      return
    }
    if (!trimmedChildLastName) {
      setError('El apellido es obligatorio.')
      return
    }
    if (attendance === 'confirmed' && hasFoodOptions && !foodPreference.trim()) {
      setError('Selecciona una opción de comida.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase
      .from('rsvps')
      .update({
        attendance_status: payload.attendance_status,
        guest_parent_name: payload.guest_parent_name,
        guest_parent_email: payload.guest_parent_email,
        guest_parent_phone: payload.guest_parent_phone,
        child_name: payload.child_name,
        food_preference: payload.food_preference,
        allergy_notes: payload.allergy_notes,
        extra_notes: payload.extra_notes,
      })
      .eq('edit_token', token)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSubmittedStatus(attendance)
    setLoading(false)
  }

  if (loadState === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
        <p className="text-center text-sm text-gray-600">Cargando...</p>
      </main>
    )
  }

  if (loadState === 'notfound') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <p className="text-center text-sm font-medium text-gray-900">Este enlace no es válido o ha expirado.</p>
          <p className="mt-2 text-center text-xs text-gray-500">
            Pide al organizador que te reenvíe la invitación para responder de nuevo.
          </p>
        </div>
      </main>
    )
  }

  const pageBg = getTheme(resolvedThemeKey).pageBg

  if (submittedStatus === 'confirmed') {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
        <div className="mx-auto w-full max-w-md">
          <section className={`rounded-2xl border ${activeTheme.border} bg-white p-5 shadow-xl`}>
            <p
              className={`text-center text-sm font-medium ${
                previewBrandMap[resolvedThemeKey] ?? previewBrandMap.yellow
              }`}
            >
              🎉 ¡Genial! Te esperamos en el cumple
            </p>
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-center text-xs leading-relaxed text-gray-600">{editLinkIntroCopy.confirmed}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
                <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                  {`miparty.net/rsvp/${token}`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyEditLinkToClipboard()}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100"
                >
                  {copyEditLinkDone ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  if (submittedStatus === 'declined') {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
        <div className="mx-auto w-full max-w-md">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
              {'Gracias por avisar 🙌\n¡Esperamos veros en la próxima!'}
            </p>
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-center text-xs leading-relaxed text-gray-600">{editLinkIntroCopy.declined}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
                <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                  {`miparty.net/rsvp/${token}`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyEditLinkToClipboard()}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100"
                >
                  {copyEditLinkDone ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  if (submittedStatus === 'maybe') {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
        <div className="mx-auto w-full max-w-md">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
              {
                'Gracias 🙌\nGuarda el enlace que aparece abajo para actualizar tu respuesta cuando lo tengas claro.'
              }
            </p>
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-center text-xs leading-relaxed text-gray-600">{editLinkIntroCopy.maybe}</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
                <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                  {`miparty.net/rsvp/${token}`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyEditLinkToClipboard()}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-100"
                >
                  {copyEditLinkDone ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const invitationFitClass =
    eventData?.invitation_image_fit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'

  return (
    <main className={`min-h-screen bg-gradient-to-b ${pageBg} px-4 py-8`}>
      <div className="mx-auto w-full max-w-md space-y-4">
        <div id="invitation-recap" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          {eventData?.invitation_image_url ? (
            <div className="mb-4 max-h-72 w-full overflow-hidden rounded-2xl">
              <img
                src={eventData.invitation_image_url}
                alt="Invitación"
                style={{
                  objectPosition:
                    eventData.invitation_image_fit === 'cover'
                      ? (eventData.invitation_image_position ?? '50% 50%')
                      : undefined,
                  transform:
                    eventData.invitation_image_fit === 'cover' && eventData.invitation_image_zoom
                      ? `scale(${eventData.invitation_image_zoom})`
                      : undefined,
                  transformOrigin:
                    eventData.invitation_image_fit === 'cover'
                      ? (eventData.invitation_image_position ?? '50% 50%')
                      : undefined,
                }}
                className={`max-h-72 w-full ${invitationFitClass}`}
              />
            </div>
          ) : null}
          <p className="text-center text-2xl font-bold text-gray-900">{recapHeadline}</p>
          {eventData ? (
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="text-gray-700">{`📅 ${formatSpanishFullDate(eventData.event_date)}`}</p>
              {rsvpDeadlineLabel ? (
                <p className="text-sm text-gray-500">{`Puedes confirmar hasta el ${rsvpDeadlineLabel}`}</p>
              ) : null}
              <p className="text-gray-700">
                {eventData.pickup_time
                  ? `🕒 ${formatTimeValue(eventData.start_time)} a ${formatTimeValue(eventData.pickup_time)}`
                  : `🕒 ${formatTimeValue(eventData.start_time)}`}
              </p>
              <div>
                <p className="text-gray-700">{`📍 ${eventData.location_name ?? 'Ubicación'}`}</p>
                {eventData.location_address ? (
                  <p className="pl-6 text-gray-700">{eventData.location_address}</p>
                ) : null}
              </div>
              {giftLine ? <p className="text-gray-700">{giftLine}</p> : null}
              {hasFoodOptions && foodOptions.length > 0 ? (
                <p className="text-gray-700">{`🍽️ ${foodOptions.map((option) => option.label).join(' · ')}`}</p>
              ) : null}
            </div>
          ) : null}
          {eventData?.organizer_notes?.trim() ? (
            <div className="mt-3 space-y-4">
              <p className="text-sm font-medium not-italic text-gray-800">
                <span aria-hidden>📋</span> Mensaje para los invitados
              </p>
              <p className="whitespace-pre-wrap text-sm italic text-gray-500">{eventData.organizer_notes}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
          <h2 className="text-lg font-bold text-gray-900">¿Necesitas actualizar tu respuesta?</h2>
          {loadedResponseSummary ? (
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              <span>{statusSummaryLabels[loadedResponseSummary.attendance]}</span>
              {loadedResponseSummary.childDisplayName ? (
                <>
                  {' · '}
                  <span className="font-medium text-gray-900">{loadedResponseSummary.childDisplayName}</span>
                </>
              ) : null}
              {' · '}
              <span className="text-gray-500">Cambia solo lo que necesites actualizar</span>
            </p>
          ) : null}
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <h2 className="text-base font-semibold text-gray-900">Tu asistencia</h2>

          <div className="relative z-20 mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleAttendanceSelect('confirmed')}
              className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
                attendance === 'confirmed'
                  ? `${activeTheme.border} ${activeTheme.button} text-gray-900`
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              ✅ ¡Sí!
            </button>
            <button
              type="button"
              onClick={() => handleAttendanceSelect('declined')}
              className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
                attendance === 'declined'
                  ? `${activeTheme.border} ${activeTheme.button} text-gray-900`
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              ❌ No
            </button>
            <button
              type="button"
              onClick={() => handleAttendanceSelect('maybe')}
              className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
                attendance === 'maybe'
                  ? `${activeTheme.border} ${activeTheme.button} text-gray-900`
                  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span className="text-sm">🤔 Aún no lo sé</span>
            </button>
          </div>

          {attendance ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="edit-childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre del niño/a *
                  </label>
                  <input
                    id="edit-childName"
                    type="text"
                    autoComplete="off"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    required
                    className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition focus:border-gray-300 focus:ring-2`}
                  />
                </div>
                <div>
                  <label htmlFor="edit-childLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Apellido *
                  </label>
                  <input
                    id="edit-childLastName"
                    type="text"
                    value={childLastName}
                    onChange={(e) => setChildLastName(e.target.value)}
                    required
                    className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition focus:border-gray-300 focus:ring-2`}
                  />
                </div>
              </div>

              {attendance === 'confirmed' && hasFoodOptions && foodOptions.length > 1 ? (
                <fieldset className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Preferencia de comida *</p>
                  {foodOptions.map((option) => (
                    <label key={option.label} className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        name="foodPreference"
                        value={option.label}
                        checked={foodPreference === option.label}
                        onChange={(e) => setFoodPreference(e.target.value)}
                        className={`h-4 w-4 border-gray-300 ${resolvedThemeKey === 'yellow' ? 'text-yellow-500 focus:ring-yellow-400' : 'text-gray-500'}`}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ) : null}

              {attendance === 'confirmed' && hasFoodOptions ? (
                <div>
                  <label htmlFor="edit-allergyNotes" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Alergias o intolerancias (opcional)
                  </label>
                  <input
                    id="edit-allergyNotes"
                    type="text"
                    value={allergyNotes}
                    onChange={(e) => setAllergyNotes(e.target.value)}
                    placeholder="Ej. Sin gluten, alergia a frutos secos..."
                    className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition placeholder:text-gray-400 focus:border-gray-300 focus:ring-2`}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="edit-parentName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Tu nombre *
                </label>
                <input
                  id="edit-parentName"
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  required
                  className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition focus:border-gray-300 focus:ring-2`}
                />
              </div>

              {attendance === 'confirmed' ? (
                <div>
                  <label htmlFor="edit-parentPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Teléfono *
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      ref={parentDialRef}
                      className={
                        parentCountryCode === 'otro'
                          ? 'relative w-20 max-w-20 flex-shrink-0'
                          : 'relative w-28 max-w-28 flex-shrink-0'
                      }
                    >
                      <button
                        type="button"
                        id="edit-parentCountryCode"
                        aria-expanded={parentDialOpen}
                        aria-haspopup="listbox"
                        onClick={() => setParentDialOpen((open) => !open)}
                        className={`flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none transition focus:ring-2 ${inputFocusClass}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{dialCodeShortLabel(parentCountryCode)}</span>
                        <span className="shrink-0 text-[10px] leading-none text-gray-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {parentDialOpen ? (
                        <ul
                          role="listbox"
                          className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        >
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={parentCountryCode === '+34'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setParentCountryCode('+34')
                                setParentDialOpen(false)
                              }}
                            >
                              🇪🇸 +34 (España)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={parentCountryCode === '+57'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setParentCountryCode('+57')
                                setParentDialOpen(false)
                              }}
                            >
                              🇨🇴 +57 (Colombia)
                            </button>
                          </li>
                          <li role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={parentCountryCode === 'otro'}
                              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setParentCountryCode('otro')
                                setParentDialOpen(false)
                              }}
                            >
                              ✏️ Otro
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </div>
                    {parentCountryCode === 'otro' ? (
                      <input
                        type="text"
                        inputMode="tel"
                        autoComplete="tel-country-code"
                        value={parentCustomCode}
                        onChange={(e) => setParentCustomCode(sanitizeDialPrefix(e.target.value))}
                        maxLength={5}
                        placeholder="+00"
                        aria-label="Prefijo internacional"
                        className={`w-16 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${inputFocusClass}`}
                      />
                    ) : null}
                    <input
                      id="edit-parentPhone"
                      type="tel"
                      value={parentPhoneNumber}
                      onChange={(e) => setParentPhoneNumber(e.target.value)}
                      required
                      placeholder="Ej. 612345678"
                      className={`min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${inputFocusClass}`}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label htmlFor="edit-extraNotes" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Mensaje para el organizador (opcional)
                </label>
                <textarea
                  ref={messageRef}
                  id="edit-extraNotes"
                  value={extraNotes}
                  onChange={handleMessageInput}
                  placeholder={placeholderText}
                  rows={4}
                  style={{ minHeight: '100px', maxHeight: '250px', resize: 'none' }}
                  className={`h-10 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition placeholder:text-gray-400 focus:border-gray-300 focus:ring-2`}
                />
              </div>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading || !attendance || !hasFormChanges}
                className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                  loading || !attendance || !hasFormChanges
                    ? 'border border-gray-200 bg-gray-200 text-gray-500'
                    : `${activeTheme.button} text-gray-900 ${activeTheme.buttonHover}`
                }`}
              >
                {loading ? 'Guardando...' : submitText}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  )
}
