'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AttendanceStatus = 'confirmed' | 'declined' | 'maybe'

type Props = {
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
  childName: string
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

export default function RsvpForm({
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
  childName: eventChildName,
}: Props) {
  const supabase = createClient()
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null)
  const [childName, setChildName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [foodPreference, setFoodPreference] = useState('')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedStatus, setSubmittedStatus] = useState<AttendanceStatus | null>(null)
  const [showCalendarOptions, setShowCalendarOptions] = useState(false)

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
      return '🎉 ¡Genial! Confirma los detalles abajo'
    }
    if (attendance === 'declined') {
      return 'Gracias por avisar 🙌'
    }
    if (attendance === 'maybe') {
      return 'Sin problema 👍 puedes decidir más tarde'
    }
    return ''
  }, [attendance])

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
    if (attendance === 'confirmed' && hasFoodOptions && foodOptions.length === 1) {
      setFoodPreference(foodOptions[0]?.label ?? '')
      return
    }
    if (attendance !== 'confirmed') {
      setFoodPreference('')
    }
  }, [attendance, hasFoodOptions, foodOptions])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!attendance) {
      return
    }

    setError(null)

    const trimmedParentName = parentName.trim()
    const trimmedChildName = childName.trim()
    const trimmedParentEmail = parentEmail.trim()
    const trimmedParentPhone = parentPhone.trim()
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

    if (attendance === 'confirmed' && hasFoodOptions && !trimmedFoodPreference) {
      setError('Selecciona una opción de comida.')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase.from('rsvps').insert({
      event_id: eventId,
      guest_parent_name: trimmedParentName,
      guest_parent_email: trimmedParentEmail || null,
      guest_parent_phone: trimmedParentPhone || null,
      child_name: trimmedChildName,
      attendance_status: attendance,
      food_preference: attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null,
      allergy_notes: attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null,
      extra_notes: trimmedExtraNotes || null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

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

  if (submittedStatus === 'confirmed') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="text-center text-sm font-medium text-gray-800">
          🎉 ¡Genial! Te esperamos en el cumple
        </p>
        <button
          type="button"
          onClick={() => setShowCalendarOptions((previous) => !previous)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-yellow-400 px-3 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
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
      </section>
    )
  }

  if (submittedStatus === 'declined') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {'Gracias por avisar 🙌\n¡Esperamos veros en la próxima!'}
        </p>
      </section>
    )
  }

  if (submittedStatus === 'maybe') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {'Gracias 🙌\nCuando lo tengas claro puedes volver y actualizar tu respuesta'}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
      <h2 className="text-base font-semibold text-gray-900">Confirma tu asistencia</h2>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setAttendance('confirmed')}
          className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
            attendance === 'confirmed'
              ? 'border-yellow-400 bg-yellow-400 text-gray-900'
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          ✅ ¡Sí!
        </button>

        <button
          type="button"
          onClick={() => setAttendance('declined')}
          className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
            attendance === 'declined'
              ? 'border-yellow-400 bg-yellow-400 text-gray-900'
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          ❌ No
        </button>

        <button
          type="button"
          onClick={() => setAttendance('maybe')}
          className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
            attendance === 'maybe'
              ? 'border-yellow-400 bg-yellow-400 text-gray-900'
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
          }`}
        >
          <span className="text-sm">🤔 Aún no lo sé</span>
        </button>
      </div>

      {attendance ? <p className="py-2 text-center text-sm text-gray-500">{helperText}</p> : null}

      {attendance ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre del niño/a *
              </label>
              <input
                id="childName"
                type="text"
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="childLastName" className="mb-1.5 block text-sm font-medium text-gray-400">
                Apellido (si hace falta)
              </label>
              <input
                id="childLastName"
                type="text"
                value={childLastName}
                onChange={(event) => setChildLastName(event.target.value)}
                placeholder=""
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
            />
          </div>

          {attendance === 'confirmed' ? (
            <div>
              <label htmlFor="parentPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                Teléfono *
              </label>
              <input
                id="parentPhone"
                type="tel"
                value={parentPhone}
                onChange={(event) => setParentPhone(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="extraNotes" className="mb-1.5 block text-sm font-medium text-gray-900">
              Mensaje para el organizador (opcional)
            </label>
            <textarea
              id="extraNotes"
              value={extraNotes}
              onChange={(event) => setExtraNotes(event.target.value)}
              placeholder={placeholderText}
              rows={2}
              style={{ resize: 'none' }}
              className="h-16 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-yellow-400 px-3 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Enviando...' : submitText}
          </button>
        </form>
      ) : null}
    </section>
  )
}
