'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTheme } from '@/lib/themes'

const previewBrandMap: Record<
  'yellow' | 'pink' | 'blue' | 'green' | 'purple',
  string
> = {
  yellow: 'text-yellow-500',
  pink: 'text-pink-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
  purple: 'text-purple-500',
}

export function InvitationPreviewTopBar({
  publicSlug,
  themeKey,
}: {
  publicSlug: string
  themeKey: string | null
}) {
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const theme = getTheme(themeKey)
  const t =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const shareHref = `/dashboard/events/${publicSlug}/share?theme=${encodeURIComponent(t)}`
  const dashboardHref = `/dashboard/events/${publicSlug}`
  const backHref = fromParam === 'dashboard' ? dashboardHref : shareHref
  const brandClass = previewBrandMap[t] ?? previewBrandMap.yellow

  return (
    <div className={`sticky top-0 z-50 mb-4 w-full border-b border-gray-200 ${theme.bg}/95 shadow-sm backdrop-blur-sm`}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <Link href={backHref} className="text-sm font-medium text-gray-900 hover:underline">
          ← Volver
        </Link>
        <p className={`text-sm font-semibold ${brandClass}`}>MiParty</p>
      </div>
    </div>
  )
}

type AttendanceStatus = 'confirmed' | 'declined' | 'maybe'

type RsvpFormInnerProps = {
  eventId: string
  foodOptions: { label: string }[]
  hasFoodOptions: boolean
  eventTitle: string
  eventDate: string
  startTime: string
  pickupTime: string | null
  locationName: string | null
  locationAddress: string | null
  googleMapsUrl: string | null
  organizerNotes: string | null
  organizerPhone: string | null
  childName: string
  isPreview?: boolean
  rsvpDeadline?: string | null
  theme?: ReturnType<typeof getTheme>
  themeKey?: string | null
}

type RsvpFormProps = RsvpFormInnerProps & {
  isPreview?: boolean
}

type ThemeKeyType = 'yellow' | 'pink' | 'blue' | 'green' | 'purple'

const inputFocusMap: Record<ThemeKeyType, string> = {
  yellow: 'ring-yellow-400 focus:border-yellow-400',
  pink: 'ring-pink-400 focus:border-pink-400',
  blue: 'ring-blue-400 focus:border-blue-400',
  green: 'ring-green-400 focus:border-green-400',
  purple: 'ring-purple-400 focus:border-purple-400',
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

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function normalizeTime(rawTime: string) {
  const [hourPart = '00', minutePart = '00'] = rawTime.split(':')
  const hour = Number.parseInt(hourPart, 10)
  const minute = Number.parseInt(minutePart, 10)
  return {
    hour: Number.isNaN(hour) ? 0 : hour,
    minute: Number.isNaN(minute) ? 0 : minute,
  }
}

function buildCalendarDateTime(dateIso: string, timeValue: string) {
  const [yearPart = '1970', monthPart = '01', dayPart = '01'] = dateIso.split('-')
  const year = Number.parseInt(yearPart, 10)
  const month = Number.parseInt(monthPart, 10)
  const day = Number.parseInt(dayPart, 10)
  const normalized = normalizeTime(timeValue)
  const date = new Date(year, month - 1, day, normalized.hour, normalized.minute, 0)
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${hh}${mm}${ss}`
}

function RsvpFormInner({
  eventId,
  foodOptions,
  hasFoodOptions,
  eventTitle,
  eventDate,
  startTime,
  pickupTime,
  locationName,
  locationAddress,
  googleMapsUrl,
  organizerNotes,
  organizerPhone,
  childName: eventChildName,
  isPreview = false,
  rsvpDeadline = null,
  theme,
  themeKey = null,
}: RsvpFormInnerProps) {
  const activeTheme = theme ?? getTheme()
  const resolvedThemeKey: ThemeKeyType =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const inputFocusClass = inputFocusMap[resolvedThemeKey]
  const supabase = createClient()
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
  const [previewSubmitted, setPreviewSubmitted] = useState(false)
  const [showCalendarOptions, setShowCalendarOptions] = useState(false)
  const childNameInputRef = useRef<HTMLInputElement | null>(null)
  const formFieldsRef = useRef<HTMLFormElement | null>(null)
  const siButtonRef = useRef<HTMLButtonElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [parentDialOpen, setParentDialOpen] = useState(false)
  const parentDialRef = useRef<HTMLDivElement>(null)
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    id: string
    child_name: string | null
    edit_token: string | null
  } | null>(null)
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false)
  const [submittedEditToken, setSubmittedEditToken] = useState<string | null>(null)
  const [copyEditLinkDone, setCopyEditLinkDone] = useState(false)
  const copyEditLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMessageInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    setExtraNotes(e.target.value)
  }

  const submitText = useMemo(() => {
    if (attendance === 'confirmed') {
      return 'Confirmar asistencia'
    }
    if (attendance === 'declined') {
      return 'Avisar que no podrá asistir'
    }
    if (attendance === 'maybe') {
      return 'Guardar como pendiente'
    }
    return 'Enviar respuesta'
  }, [attendance])

  const helperText = useMemo(() => {
    if (attendance === 'confirmed') {
      return '🎉 ¡Genial! Confirma los detalles abajo.'
    }
    if (attendance === 'declined') {
      return 'Gracias por avisar 🙌'
    }
    if (attendance === 'maybe') {
      if (rsvpDeadline) {
        return `Sin problema 👍 puedes decidir más tarde.\nEsperamos tu respuesta hasta el ${capitalizeFirst(rsvpDeadline)}.`
      }
      return 'Sin problema 👍 puedes decidir más tarde.'
    }
    return ''
  }, [attendance, rsvpDeadline])

  const placeholderText = useMemo(() => {
    if (attendance === 'confirmed') {
      return 'Ej. ¡Genial! Irá encantado/a'
    }
    if (attendance === 'declined') {
      return 'Ej. Lo siento, esta vez no podremos ir'
    }
    return 'Ej. Tengo que mirarlo y te confirmo en cuanto pueda'
  }, [attendance])

  const calendarStart = useMemo(() => buildCalendarDateTime(eventDate, startTime), [eventDate, startTime])

  const calendarEnd = useMemo(() => {
    if (pickupTime) {
      return buildCalendarDateTime(eventDate, pickupTime)
    }
    const start = normalizeTime(startTime)
    const fallbackEnd = `${String(Math.min(start.hour + 2, 23)).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`
    return buildCalendarDateTime(eventDate, fallbackEnd)
  }, [eventDate, pickupTime, startTime])

  const calendarLocation = useMemo(
    () => `${locationName ?? ''}${locationName && locationAddress ? ', ' : ''}${locationAddress ?? ''}`.trim(),
    [locationAddress, locationName]
  )

  const calendarDescription = useMemo(() => {
    const detailLines = [
      organizerNotes?.trim() || '',
      googleMapsUrl?.trim() || '',
      `Invitación para ${eventChildName}`,
    ].filter(Boolean)
    return detailLines.join('\n')
  }, [eventChildName, googleMapsUrl, organizerNotes])

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
      if (copyEditLinkTimeoutRef.current != null) {
        clearTimeout(copyEditLinkTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (attendance === 'confirmed' && hasFoodOptions && foodOptions.length === 1) {
      setFoodPreference(foodOptions[0]?.label ?? '')
      return
    }
    if (attendance !== 'confirmed') {
      setFoodPreference('')
    }
  }, [attendance, hasFoodOptions, foodOptions])

  const editLinkIntroCopy: Record<AttendanceStatus, string> = {
    confirmed: 'Guarda este enlace por si necesitas cambiar tu respuesta más tarde:',
    declined: 'Guarda este enlace por si cambias de opinión:',
    maybe: 'Usa este enlace para confirmar tu asistencia cuando lo tengas claro:',
  }

  const copyEditLinkToClipboard = async () => {
    if (!submittedEditToken) return
    const url = `https://miparty.net/rsvp/${submittedEditToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyEditLinkDone(true)
      if (copyEditLinkTimeoutRef.current != null) {
        clearTimeout(copyEditLinkTimeoutRef.current)
      }
      copyEditLinkTimeoutRef.current = setTimeout(() => {
        setCopyEditLinkDone(false)
        copyEditLinkTimeoutRef.current = null
      }, 2000)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  const handleUpdateExistingRsvp = async () => {
    if (isPreview || !attendance || !duplicatePrompt) return
    setError(null)
    const trimmedParentName = parentName.trim()
    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    const trimmedParentEmail = parentEmail.trim()
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    if (attendance === 'confirmed' && parentCountryCode === 'otro' && finalParentDial.length <= 1) {
      setError('Indica el prefijo internacional (ej. +44).')
      return
    }
    const trimmedParentPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''
    const trimmedFoodPreference = foodPreference.trim()
    const trimmedAllergyNotes = allergyNotes.trim()
    const trimmedExtraNotes = extraNotes.trim()

    if (!trimmedParentName) {
      setError('El nombre del padre/madre es obligatorio.')
      return
    }
    if (!trimmedChildName) {
      setError('El nombre del niño/a es obligatorio.')
      return
    }
    if (!trimmedChildLastName) {
      setError('El apellido es obligatorio.')
      return
    }
    if (attendance === 'confirmed' && hasFoodOptions && !trimmedFoodPreference) {
      setError('Selecciona una opción de comida.')
      return
    }

    const combinedChildName =
      trimmedChildLastName.length > 0 ? `${trimmedChildName} ${trimmedChildLastName}` : trimmedChildName

    setLoading(true)
    const { error: updateError } = await supabase
      .from('rsvps')
      .update({
        attendance_status: attendance,
        guest_parent_name: trimmedParentName,
        guest_parent_email: trimmedParentEmail || null,
        guest_parent_phone: trimmedParentPhone || null,
        child_name: combinedChildName,
        food_preference: attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null,
        allergy_notes: attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null,
        extra_notes: trimmedExtraNotes || null,
      })
      .eq('id', duplicatePrompt.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSubmittedEditToken(duplicatePrompt.edit_token ?? null)
    setSubmittedStatus(attendance)
    setDuplicatePrompt(null)
    setIgnoreDuplicate(false)
    setLoading(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPreview) {
      setError(null)
      setPreviewSubmitted(true)
      return
    }
    if (!attendance) {
      return
    }

    setError(null)

    const trimmedParentName = parentName.trim()
    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    const trimmedParentEmail = parentEmail.trim()
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    if (attendance === 'confirmed' && parentCountryCode === 'otro' && finalParentDial.length <= 1) {
      setError('Indica el prefijo internacional (ej. +44).')
      return
    }
    const trimmedParentPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''
    const trimmedFoodPreference = foodPreference.trim()
    const trimmedAllergyNotes = allergyNotes.trim()
    const trimmedExtraNotes = extraNotes.trim()

    if (!trimmedParentName) {
      setError('El nombre del padre/madre es obligatorio.')
      return
    }

    if (!trimmedChildName) {
      setError('El nombre del niño/a es obligatorio.')
      return
    }

    if (!trimmedChildLastName) {
      setError('El apellido es obligatorio.')
      return
    }

    if (attendance === 'confirmed' && hasFoodOptions && !trimmedFoodPreference) {
      setError('Selecciona una opción de comida.')
      return
    }

    const combinedChildName =
      trimmedChildLastName.length > 0 ? `${trimmedChildName} ${trimmedChildLastName}` : trimmedChildName

    setLoading(true)

    if (!ignoreDuplicate && trimmedParentPhone) {
      const { data: existingRsvp } = await supabase
        .from('rsvps')
        .select('id, attendance_status, child_name, edit_token')
        .eq('event_id', eventId)
        .eq('guest_parent_phone', trimmedParentPhone)
        .maybeSingle()

      if (existingRsvp?.id) {
        setDuplicatePrompt({
          id: existingRsvp.id,
          child_name: existingRsvp.child_name,
          edit_token: existingRsvp.edit_token,
        })
        setLoading(false)
        return
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('rsvps')
      .insert({
        event_id: eventId,
        guest_parent_name: trimmedParentName,
        guest_parent_email: trimmedParentEmail || null,
        guest_parent_phone: trimmedParentPhone || null,
        child_name: combinedChildName,
        attendance_status: attendance,
        food_preference: attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null,
        allergy_notes: attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null,
        extra_notes: trimmedExtraNotes || null,
      })
      .select('edit_token')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSubmittedEditToken(inserted?.edit_token ?? null)
    setSubmittedStatus(attendance)
    setLoading(false)
  }

  const handleGoogleCalendar = () => {
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${calendarStart}/${calendarEnd}&details=${encodeURIComponent(calendarDescription)}&location=${encodeURIComponent(calendarLocation)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const downloadIcsFile = (filename: string) => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${calendarStart}
DTEND:${calendarEnd}
SUMMARY:${eventTitle}
LOCATION:${calendarLocation}
DESCRIPTION:${calendarDescription}
END:VEVENT
END:VCALENDAR`
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const previewHelperBlock = isPreview ? (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm whitespace-pre-line text-yellow-800">
      {'👁️ Vista previa — así podrán responder tus invitados.\nPuedes probarlo con tranquilidad — nada se guardará.'}
    </div>
  ) : null

  const handleAttendanceSelect = (nextStatus: AttendanceStatus) => {
    const shouldDeselect = attendance === nextStatus
    setAttendance(shouldDeselect ? null : nextStatus)
    if (!shouldDeselect) {
      if (nextStatus === 'declined' || nextStatus === 'maybe') {
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }, 0)
      } else if (nextStatus === 'confirmed') {
        setTimeout(() => {
          if (siButtonRef.current) {
            siButtonRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
          childNameInputRef.current?.focus()
        }, 100)
      }
    }
  }

  if (submittedStatus === 'confirmed') {
    return (
      <section className={`rounded-2xl border ${activeTheme.border} bg-white p-5 shadow-xl`}>
        <p
          className={`text-center text-sm font-medium ${
            previewBrandMap[resolvedThemeKey] ?? previewBrandMap.yellow
          }`}
        >
          🎉 ¡Genial! Te esperamos en el cumple
        </p>
        <button
          type="button"
          onClick={() => setShowCalendarOptions((previous) => !previous)}
          className={`mt-3 inline-flex w-full items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-semibold text-gray-900 transition ${activeTheme.border} ${activeTheme.button} ${activeTheme.buttonHover}`}
        >
          Añadir al calendario
        </button>
        {showCalendarOptions ? (
          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleGoogleCalendar}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Google Calendar
            </button>
            <button
              type="button"
              onClick={() => downloadIcsFile('evento-apple.ics')}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Apple Calendar
            </button>
            <button
              type="button"
              onClick={() => downloadIcsFile('evento-outlook.ics')}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Outlook
            </button>
          </div>
        ) : null}
        {!isPreview && submittedEditToken ? (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
            <p className="text-center text-xs leading-relaxed text-gray-600">
              {editLinkIntroCopy.confirmed}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
              <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                {`miparty.net/rsvp/${submittedEditToken}`}
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
        ) : null}
      </section>
    )
  }

  if (submittedStatus === 'declined') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {'Gracias por avisar 🙌\n¡Esperamos veros en la próxima!'}
        </p>
        {!isPreview && submittedEditToken ? (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
            <p className="text-center text-xs leading-relaxed text-gray-600">{editLinkIntroCopy.declined}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
              <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                {`miparty.net/rsvp/${submittedEditToken}`}
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
        ) : null}
      </section>
    )
  }

  if (submittedStatus === 'maybe') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {
            'Gracias 🙌\nGuarda el enlace que aparece abajo para actualizar tu respuesta cuando lo tengas claro.'
          }
        </p>
        {!isPreview && submittedEditToken ? (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
            <p className="text-center text-xs leading-relaxed text-gray-600">{editLinkIntroCopy.maybe}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
              <code className="block max-w-full flex-1 break-all rounded-lg bg-white px-2 py-2 text-left text-[11px] text-gray-700">
                {`miparty.net/rsvp/${submittedEditToken}`}
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
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
      {isPreview ? <div className="relative z-20 mb-3 pointer-events-auto">{previewHelperBlock}</div> : null}
      <h2 className="text-base font-semibold text-gray-900">Confirma tu asistencia</h2>

      <div className="relative z-20 mt-3 flex gap-2 pointer-events-auto">
        <button
          ref={siButtonRef}
          type="button"
          onClick={() => handleAttendanceSelect('confirmed')}
          className={`pointer-events-auto inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
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
          className={`pointer-events-auto inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
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
          className={`pointer-events-auto inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
            attendance === 'maybe'
              ? `${activeTheme.border} ${activeTheme.button} text-gray-900`
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          <span className="text-sm">🤔 Aún no lo sé</span>
        </button>
      </div>

      <div className="flex h-10 items-center justify-center py-2 text-center text-gray-500">
        <p className={`whitespace-pre-line ${attendance === 'maybe' ? 'text-xs' : 'text-sm'}`}>{helperText}</p>
      </div>

      {attendance ? (
        <form ref={formFieldsRef} onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre del niño/a *
              </label>
              <input
                id="childName"
                ref={childNameInputRef}
                type="text"
                autoComplete="off"
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition focus:border-gray-300 focus:ring-2`}
              />
            </div>

            <div>
              <label htmlFor="childLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Apellido *
              </label>
              <input
                id="childLastName"
                type="text"
                value={childLastName}
                onChange={(event) => setChildLastName(event.target.value)}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                placeholder=""
                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition placeholder:text-gray-400 focus:border-gray-300 focus:ring-2`}
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
                    onChange={(event) => setFoodPreference(event.target.value)}
                    className="h-4 w-4 border-gray-300 text-yellow-500 focus:ring-yellow-400"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : null}

          {attendance === 'confirmed' && hasFoodOptions ? (
            <div>
              <label htmlFor="allergyNotes" className="mb-1.5 block text-sm font-medium text-gray-900">
                Alergias o intolerancias (opcional)
              </label>
              <input
                id="allergyNotes"
                type="text"
                value={allergyNotes}
                onChange={(event) => setAllergyNotes(event.target.value)}
                placeholder="Ej. Sin gluten, alergia a frutos secos..."
                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition placeholder:text-gray-400 focus:border-gray-300 focus:ring-2`}
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="parentName" className="mb-1.5 block text-sm font-medium text-gray-900">
              Tu nombre *
            </label>
            <input
              id="parentName"
              type="text"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
              required
              onInvalid={(e) => {
                (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
              }}
              onInput={(e) => {
                (e.target as HTMLInputElement).setCustomValidity('')
              }}
              className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ${activeTheme.accent} transition focus:border-gray-300 focus:ring-2`}
            />
          </div>

          {attendance === 'confirmed' ? (
            <div>
              <label htmlFor="parentPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
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
                    id="parentCountryCode"
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
                    onChange={(event) => setParentCustomCode(sanitizeDialPrefix(event.target.value))}
                    maxLength={5}
                    placeholder="+00"
                    aria-label="Prefijo internacional"
                    className={`w-16 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${inputFocusClass}`}
                  />
                ) : null}
                <input
                  id="parentPhone"
                  type="tel"
                  value={parentPhoneNumber}
                  onChange={(event) => setParentPhoneNumber(event.target.value)}
                  required
                  placeholder="Ej. 612345678"
                  onInvalid={(e) => {
                    (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                  }}
                  onInput={(e) => {
                    (e.target as HTMLInputElement).setCustomValidity('')
                  }}
                  className={`min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${inputFocusClass}`}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="extraNotes" className="mb-1.5 block text-sm font-medium text-gray-900">
              Mensaje para el organizador (opcional)
            </label>
            <textarea
              ref={messageRef}
              id="extraNotes"
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

          {duplicatePrompt ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-gray-800">
              <p className="font-medium text-gray-900">Encontramos una respuesta anterior con este número.</p>
              <p className="mt-1 text-gray-700">
                Respuesta de: {duplicatePrompt.child_name?.trim() ? duplicatePrompt.child_name : '—'}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleUpdateExistingRsvp()}
                  className={`inline-flex flex-1 items-center justify-center rounded-lg ${activeTheme.button} px-3 py-2.5 text-sm font-semibold text-gray-900 transition ${activeTheme.buttonHover} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {loading ? 'Guardando...' : 'Actualizar mi respuesta anterior'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setIgnoreDuplicate(true)
                    setDuplicatePrompt(null)
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Es otro niño/a que también viene
                </button>
              </div>
            </div>
          ) : null}

          {!isPreview && !duplicatePrompt ? (
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-lg ${activeTheme.button} px-3 py-2.5 text-sm font-semibold text-gray-900 transition ${activeTheme.buttonHover} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {loading ? 'Enviando...' : submitText}
            </button>
          ) : null}
        </form>
      ) : null}
      {isPreview && attendance ? (
        <button
          type="button"
          disabled
          className="w-full bg-gray-200 text-gray-400 font-semibold py-3 rounded-xl text-sm cursor-not-allowed opacity-60"
        >
          {submitText}
        </button>
      ) : null}
    </section>
  )
}

export default function RsvpForm({ isPreview, ...inner }: RsvpFormProps) {
  return <RsvpFormInner {...inner} isPreview={isPreview} />
}
