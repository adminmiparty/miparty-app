'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { DayPicker, type Matcher } from 'react-day-picker'
import { format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import 'react-day-picker/style.css'

type Child = {
  id: string
  name: string
  birth_date: string | null
}

type GiftOption = 'regalo_libre' | 'bizum_pool'
const NEW_CHILD_VALUE = '__new__'
const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatIsoToDisplayDate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return ''
  }
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

function formatDisplayToIsoDate(displayDate: string) {
  const match = displayDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) {
    return null
  }
  const [, day, month, year] = match
  const dayNumber = Number.parseInt(day, 10)
  const monthNumber = Number.parseInt(month, 10)
  const yearNumber = Number.parseInt(year, 10)

  if (
    Number.isNaN(dayNumber) ||
    Number.isNaN(monthNumber) ||
    Number.isNaN(yearNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null
  }

  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber)
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() + 1 !== monthNumber ||
    parsed.getDate() !== dayNumber
  ) {
    return null
  }

  return `${year}-${month}-${day}`
}

function formatDateInputValue(rawValue: string) {
  const digits = rawValue.replace(/\D/g, '').slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)

  if (digits.length <= 2) {
    return day
  }
  if (digits.length <= 4) {
    return `${day}/${month}`
  }
  return `${day}/${month}/${year}`
}

function formatEventDateInputValue(rawValue: string) {
  const digits = rawValue.replace(/\D/g, '').slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const currentYear = String(new Date().getFullYear())

  if (digits.length <= 2) {
    return day
  }
  if (digits.length < 4) {
    return `${day}/${month}`
  }
  if (digits.length === 4) {
    return `${day}/${month}/${currentYear}`
  }
  return `${day}/${month}/${year}`
}

function formatSpanishWeekday(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
  })
}

function parse24hTime(time24h: string) {
  const [hours, minutes] = time24h.split(':')
  return {
    hour: String(Number.parseInt(hours, 10)),
    minutes: minutes ?? '00',
  }
}

function build24hTime(hour: string, minutes: string) {
  const hourNumber = Number.parseInt(hour, 10)
  if (Number.isNaN(hourNumber)) {
    return ''
  }
  return `${String(hourNumber).padStart(2, '0')}:${minutes}`
}

type InlineTimePickerProps = {
  value: string
  onChange: (value: string) => void
  optional?: boolean
}

function InlineTimePicker({ value, onChange, optional = false }: InlineTimePickerProps) {
  const parsed = value ? parse24hTime(value) : null
  const selectedHour = parsed?.hour ?? ''
  const selectedMinutes = parsed?.minutes ?? ''

  useEffect(() => {
    if (!optional && !value) {
      onChange('17:00')
    }
  }, [optional, onChange, value])

  const handleHourChange = (nextHour: string) => {
    if (optional) {
      if (!nextHour) {
        onChange('')
        return
      }
      if (!selectedMinutes) {
        onChange('')
        return
      }
      onChange(build24hTime(nextHour, selectedMinutes))
      return
    }
    onChange(build24hTime(nextHour, selectedMinutes || '00'))
  }

  const handleMinutesChange = (nextMinutes: string) => {
    if (optional) {
      if (!selectedHour || !nextMinutes) {
        onChange('')
        return
      }
      onChange(build24hTime(selectedHour, nextMinutes))
      return
    }
    onChange(build24hTime(selectedHour || '17', nextMinutes || '00'))
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={selectedHour}
        onChange={(event) => handleHourChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
      >
        {optional ? <option value="">--</option> : null}
        {Array.from({ length: 23 }, (_, index) => String(index + 1)).map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>

      <select
        value={selectedMinutes}
        onChange={(event) => handleMinutesChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
      >
        {optional ? <option value="">--</option> : null}
        {['00', '15', '30', '45'].map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
    </div>
  )
}

function generatePublicSlug(title: string) {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const randomSuffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'evento'}-${randomSuffix}`
}

export default function NewEventPage() {
  const router = useRouter()
  const supabase = createClient()

  const [children, setChildren] = useState<Child[]>([])
  const [childrenLoading, setChildrenLoading] = useState(true)
  const [selectedChildId, setSelectedChildId] = useState('')

  const [childName, setChildName] = useState('')
  const [childBirthDate, setChildBirthDate] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [eventTitle, setEventTitle] = useState('')
  const [eventTitleManuallyEdited, setEventTitleManuallyEdited] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [startTime, setStartTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')

  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')

  const [giftOption, setGiftOption] = useState<GiftOption>('regalo_libre')
  const [bizumCountryCode, setBizumCountryCode] = useState('+34')
  const [bizumPhoneNumber, setBizumPhoneNumber] = useState('')

  const [foodEnabled, setFoodEnabled] = useState(false)
  const [foodOptions, setFoodOptions] = useState<string[]>([''])

  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChildren = children.length > 0

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )
  const isCreatingNewChild = !hasChildren || selectedChildId === NEW_CHILD_VALUE
  const parsedEventDate = formatDisplayToIsoDate(eventDate)
  const selectedEventDate = parsedEventDate
    ? (() => {
        const [year, month, day] = parsedEventDate.split('-').map((value) => Number.parseInt(value, 10))
        return new Date(year, month - 1, day)
      })()
    : undefined

  const applyAutoEventTitle = (name: string) => {
    if (eventTitleManuallyEdited) {
      return
    }
    const firstName = name.trim().split(/\s+/)[0]
    if (!firstName) {
      setEventTitle('')
      return
    }
    setEventTitle(`Cumple de ${firstName}`)
  }

  useEffect(() => {
    let isMounted = true

    const loadChildren = async () => {
      setChildrenLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (isMounted) {
          setChildren([])
          setChildrenLoading(false)
          setError(userError?.message ?? 'No se pudo obtener tu sesión. Inicia sesión de nuevo.')
        }
        return
      }

      const { data, error: childrenError } = await supabase
        .from('children')
        .select('id, name, birth_date')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (isMounted) {
        if (childrenError) {
          setChildren([])
          setError(childrenError.message)
        } else {
          const loadedChildren = (data ?? []) as Child[]
          setChildren(loadedChildren)
          if (loadedChildren.length > 0) {
            const firstChild = loadedChildren[0]
            setSelectedChildId(firstChild.id)
            setChildName(firstChild.name)
            syncChildBirthDateFromDisplayValue(
              firstChild.birth_date ? formatIsoToDisplayDate(firstChild.birth_date) : ''
            )
            applyAutoEventTitle(firstChild.name)
          } else {
            setSelectedChildId(NEW_CHILD_VALUE)
          }
        }
        setChildrenLoading(false)
      }
    }

    void loadChildren()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const handleChildSelect = (id: string) => {
    setSelectedChildId(id)

    if (id === NEW_CHILD_VALUE) {
      setChildName('')
      handleChildBirthDateChange('', '', '')
      applyAutoEventTitle('')
      return
    }

    const child = children.find((item) => item.id === id)
    if (!child) {
      return
    }

    setChildName(child.name)
    syncChildBirthDateFromDisplayValue(child.birth_date ? formatIsoToDisplayDate(child.birth_date) : '')
    applyAutoEventTitle(child.name)
  }

  const handleChildNameChange = (value: string) => {
    setChildName(value)
    applyAutoEventTitle(value)
  }

  const handleEventTitleChange = (value: string) => {
    setEventTitle(value)
    setEventTitleManuallyEdited(true)
  }

  const handleChildBirthDateChange = (day: string, month: string, year: string) => {
    setBirthDay(day)
    setBirthMonth(month)
    setBirthYear(year)
    if (!day || !month || !year) {
      setChildBirthDate('')
    } else {
      setChildBirthDate(`${day}/${month}/${year}`)
    }
    if (error) {
      setError(null)
    }
  }

  const syncChildBirthDateFromDisplayValue = (displayValue: string) => {
    const parts = displayValue.split('/')
    if (parts.length === 3) {
      handleChildBirthDateChange(parts[0] ?? '', parts[1] ?? '', parts[2] ?? '')
      return
    }
    handleChildBirthDateChange('', '', '')
  }

  const updateFoodOption = (index: number, value: string) => {
    setFoodOptions((previous) => previous.map((option, idx) => (idx === index ? value : option)))
  }

  const addFoodOption = () => {
    setFoodOptions((previous) => [...previous, ''])
  }

  const removeFoodOption = (index: number) => {
    setFoodOptions((previous) => previous.filter((_, idx) => idx !== index))
  }

  const toggleFoodOptions = (enabled: boolean) => {
    setFoodEnabled(enabled)
    if (enabled && foodOptions.length === 0) {
      setFoodOptions([''])
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedChildName = childName.trim()
    const trimmedEventTitle = eventTitle.trim()
    const trimmedLocationName = locationName.trim()
    const trimmedAddress = address.trim()
    const trimmedGoogleMapsUrl = googleMapsUrl.trim()
    const trimmedBizumPhoneNumber = bizumPhoneNumber.trim()

    if (!trimmedChildName) {
      setError('El nombre del cumpleañero es obligatorio.')
      return
    }

    const parsedChildBirthDate = formatDisplayToIsoDate(childBirthDate)

    if (!eventDate) {
      setError('Por favor selecciona la fecha del evento.')
      return
    }

    if (!parsedEventDate) {
      setError('La fecha del evento no es válida. Usa el formato DD/MM/YYYY.')
      return
    }

    if (childBirthDate.trim() && !parsedChildBirthDate) {
      setError('La fecha de nacimiento no es válida. Usa el formato DD/MM/YYYY.')
      return
    }

    if (parsedChildBirthDate) {
      const birthYear = Number.parseInt(parsedChildBirthDate.slice(0, 4), 10)
      const currentYear = new Date().getFullYear()
      if (Number.isNaN(birthYear) || birthYear < 2000 || birthYear > currentYear) {
        setError('La fecha de nacimiento no es válida. El año debe estar entre 2000 y el año actual.')
        return
      }
    }

    if (!trimmedEventTitle || !eventDate || !startTime) {
      setError('Completa título, fecha del evento y hora de inicio.')
      return
    }

    if (!trimmedLocationName || !trimmedAddress) {
      setError('El nombre del lugar y la dirección son obligatorios.')
      return
    }

    if (pickupTime && pickupTime <= startTime) {
      setError('La hora de recogida debe ser posterior a la hora de inicio.')
      return
    }

    if (giftOption === 'bizum_pool' && !trimmedBizumPhoneNumber) {
      setError('Si eliges Regalo Colectivo, el teléfono es obligatorio.')
      return
    }

    const normalizedFoodOptions = foodEnabled
      ? foodOptions.map((option) => option.trim()).filter((option) => option.length > 0)
      : []

    if (foodEnabled && normalizedFoodOptions.length === 0) {
      setError('Añade al menos una opción de comida o desactiva esta sección.')
      return
    }

    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'No se pudo obtener tu sesión. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }

    const publicSlug = generatePublicSlug(trimmedEventTitle)
    console.log('event insert food toggle', { foodEnabled })

    const { data: insertedEvent, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        child_name: trimmedChildName,
        child_birth_date: parsedChildBirthDate || null,
        title: trimmedEventTitle,
        event_date: parsedEventDate,
        start_time: startTime,
        pickup_time: pickupTime || null,
        location_name: trimmedLocationName,
        location_address: trimmedAddress,
        google_maps_url: trimmedGoogleMapsUrl || null,
        gift_option: giftOption,
        bizum_phone: giftOption === 'bizum_pool' ? `${bizumCountryCode}${trimmedBizumPhoneNumber}` : null,
        enable_food_options: foodEnabled,
        organizer_notes: notes.trim() || null,
        public_slug: publicSlug,
      })
      .select('id')
      .single()

    if (eventError || !insertedEvent) {
      setError(eventError?.message ?? 'No se pudo crear el evento.')
      setLoading(false)
      return
    }

    if (foodEnabled && normalizedFoodOptions.length > 0) {
      const optionRows = normalizedFoodOptions.map((option) => ({
        event_id: insertedEvent.id,
        label: option,
      }))

      const { error: foodError } = await supabase.from('event_food_options').insert(optionRows)

      if (foodError) {
        setError(foodError.message)
        setLoading(false)
        return
      }
    }

    if (isCreatingNewChild) {
      const { error: childInsertError } = await supabase.from('children').insert({
        user_id: user.id,
        name: trimmedChildName,
        birth_date: parsedChildBirthDate || null,
      })

      if (childInsertError) {
        setError(childInsertError.message)
        setLoading(false)
        return
      }
    }

    router.push('/dashboard/events')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-6">
      <div className="mx-auto w-full max-w-sm pb-8">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-yellow-600 hover:text-yellow-700">
            ← Volver al panel
          </Link>
          <p className="font-bold text-yellow-500">MiParty</p>
        </div>

        <div className="mb-4 rounded-xl border border-yellow-100 bg-white/80 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Paso 1 de 2 — Crear evento</span>
            <span>2: Compartir invitación</span>
          </div>
          <div className="h-2 w-full rounded-full bg-yellow-100">
            <div className="h-2 w-1/2 rounded-full bg-yellow-400" />
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
          <div className="mb-5">
            <p className="text-sm text-gray-500">Completa los datos y crea tu evento en minutos.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">¿Para quién es el cumple?</h2>

              {childrenLoading ? <p className="text-sm text-gray-500">Cargando hijos...</p> : null}

              {!childrenLoading && hasChildren ? (
                <div>
                  <label htmlFor="childSelect" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Hijo/a
                  </label>
                  <select
                    id="childSelect"
                    value={selectedChildId}
                    onChange={(event) => handleChildSelect(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                  >
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                    <option value={NEW_CHILD_VALUE}>Nuevo hijo/a</option>
                  </select>
                </div>
              ) : null}

              {isCreatingNewChild ? (
                <>
                  <div>
                    <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                      Hijo/a *
                    </label>
                    <input
                      id="childName"
                      type="text"
                      value={childName}
                      onChange={(event) => handleChildNameChange(event.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                      placeholder="Ej. Sofía"
                    />
                  </div>

                  <div>
                    <label htmlFor="childBirthDate" className="mb-1.5 block text-sm font-medium text-gray-900">
                      Fecha de nacimiento *
                    </label>
                    <div id="childBirthDate" className="grid grid-cols-3 gap-2">
                      <select
                        value={birthDay}
                        onChange={(event) => handleChildBirthDateChange(event.target.value, birthMonth, birthYear)}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                      >
                        <option value="">--</option>
                        {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>

                      <select
                        value={birthMonth}
                        onChange={(event) => handleChildBirthDateChange(birthDay, event.target.value, birthYear)}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                      >
                        <option value="">--</option>
                        {SPANISH_MONTHS.map((monthName, index) => {
                          const monthValue = String(index + 1).padStart(2, '0')
                          return (
                            <option key={monthValue} value={monthValue}>
                              {monthName}
                            </option>
                          )
                        })}
                      </select>

                      <select
                        value={birthYear}
                        onChange={(event) => handleChildBirthDateChange(birthDay, birthMonth, event.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                      >
                        <option value="">--</option>
                        {Array.from(
                          { length: new Date().getFullYear() - 2000 + 1 },
                          (_, index) => String(new Date().getFullYear() - index)
                        ).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Día y hora del evento</h2>

              <div>
                <label htmlFor="eventTitle" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Título del evento *
                </label>
                <input
                  id="eventTitle"
                  type="text"
                  value={eventTitle}
                  onChange={(event) => handleEventTitleChange(event.target.value)}
                  required
                  placeholder="Ej. Cumple de Sofía"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>

              <div className="-mb-2">
                <label htmlFor="eventDate" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Fecha del evento *
                </label>
                <div className="flex w-full justify-center">
                  <DayPicker
                    mode="single"
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    selected={selectedEventDate}
                    onSelect={(date) => {
                      if (!date) {
                        return
                      }
                      setEventDate(format(date, 'dd/MM/yyyy'))
                      setCurrentMonth(date)
                    }}
                    locale={es}
                    disabled={{ before: startOfDay(new Date()) } as Matcher}
                    formatters={{
                      formatWeekdayName: (date) => {
                        const labels = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
                        return labels[date.getDay()]
                      },
                    }}
                    className="scale-90 rounded-lg border border-yellow-100 bg-white p-1 text-sm"
                    classNames={{
                      day_selected: 'bg-yellow-400 text-gray-900 rounded-md',
                      day_today: 'text-yellow-700 font-semibold',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startTime"
                    className="mb-1.5 block whitespace-nowrap text-sm font-medium text-gray-900"
                  >
                    Hora de inicio
                  </label>
                  <div id="startTime">
                    <InlineTimePicker value={startTime} onChange={setStartTime} />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pickupTime"
                    className="mb-1.5 flex h-10 items-end whitespace-nowrap text-sm font-medium text-gray-900"
                  >
                    <span>Hora de recogida</span>
                    <span className="ml-1 text-xs">(opcional)</span>
                  </label>
                  <div id="pickupTime">
                    <InlineTimePicker value={pickupTime} onChange={setPickupTime} optional />
                  </div>
                </div>
              </div>

            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Ubicación</h2>

              <div>
                <label htmlFor="locationName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Nombre del lugar *
                </label>
                <input
                  id="locationName"
                  type="text"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  required
                  placeholder="Ej. Parque del barrio"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>

              <div>
                <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Dirección *
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                  placeholder="Calle, número y ciudad"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>

              <div>
                <label htmlFor="mapsUrl" className="mb-1.5 block text-sm font-medium text-gray-900">
                  URL de Google Maps (opcional)
                </label>
                <input
                  id="mapsUrl"
                  type="url"
                  value={googleMapsUrl}
                  onChange={(event) => setGoogleMapsUrl(event.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Regalo</h2>

              <fieldset className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="giftOption"
                      value="regalo_libre"
                      checked={giftOption === 'regalo_libre'}
                      onChange={() => setGiftOption('regalo_libre')}
                      className="h-4 w-4 border-gray-300 text-yellow-500 focus:ring-yellow-400"
                    />
                    Regalo libre
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="giftOption"
                      value="bizum_pool"
                      checked={giftOption === 'bizum_pool'}
                      onChange={() => setGiftOption('bizum_pool')}
                      className="h-4 w-4 border-gray-300 text-yellow-500 focus:ring-yellow-400"
                    />
                    Regalo en grupo
                  </label>
                </div>
                {giftOption === 'bizum_pool' ? (
                  <div className="grid grid-cols-[130px_1fr] gap-2">
                    <div>
                      <label htmlFor="bizumCountryCode" className="mb-1.5 block text-sm font-medium text-gray-900">
                        País
                      </label>
                      <select
                        id="bizumCountryCode"
                        value={bizumCountryCode}
                        onChange={(event) => setBizumCountryCode(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                      >
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+57">🇨🇴 +57</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="bizumPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                        Teléfono *
                      </label>
                      <input
                        id="bizumPhone"
                        type="tel"
                        value={bizumPhoneNumber}
                        onChange={(event) => setBizumPhoneNumber(event.target.value)}
                        required
                        placeholder="Ej. 612345678"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                      />
                    </div>
                  </div>
                ) : null}

              </fieldset>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Opciones de comida</h2>

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={foodEnabled}
                  onChange={(event) => toggleFoodOptions(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                Añadir opciones de comida
              </label>

              {foodEnabled ? (
                <div className="space-y-3">
                  {foodOptions.map((option, index) => (
                    <div key={`food-option-${index}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(event) => updateFoodOption(index, event.target.value)}
                        placeholder={`Opción ${index + 1}`}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeFoodOption(index)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addFoodOption}
                    className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm font-medium text-yellow-700 transition hover:bg-yellow-100"
                  >
                    Añadir opción
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Notas para los invitados</h2>

              <div>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Información útil o mensaje especial para tus invitados"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creando evento...' : 'Crear evento'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
