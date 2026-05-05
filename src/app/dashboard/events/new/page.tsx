'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { DayPicker, type Matcher } from 'react-day-picker'
import { addDays, addMonths, format, startOfDay, subDays, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { themes, type ThemeKey } from '@/lib/themes'
import 'react-day-picker/style.css'

type Child = {
  id: string
  name: string
  birth_date: string | null
  last_name: string | null
}

function getChildDropdownDisplayName(child: Child) {
  const first = child.name.trim()
  const last = (child.last_name ?? '').trim()
  if (!last) {
    return first
  }
  return `${first} ${last}`.trim()
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

function parseIsoDateToLocal(isoDate: string) {
  const [yearPart, monthPart, dayPart] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  return new Date(yearPart, monthPart - 1, dayPart)
}

function getChildAgeOnEventDate(birthDate: Date, eventDate: Date) {
  let age = eventDate.getFullYear() - birthDate.getFullYear()
  const monthDiff = eventDate.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && eventDate.getDate() < birthDate.getDate())) {
    age -= 1
  }
  return age
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
  minHour?: number
}

function InlineTimePicker({ value, onChange, optional = false, minHour = 1 }: InlineTimePickerProps) {
  const parsed = value ? parse24hTime(value) : null
  const [optionalHour, setOptionalHour] = useState(parsed?.hour ?? '')
  const [optionalMinutes, setOptionalMinutes] = useState(parsed?.minutes ?? '')
  const selectedHour = optional ? optionalHour : parsed?.hour ?? ''
  const selectedMinutes = optional ? optionalMinutes : parsed?.minutes ?? '00'

  useEffect(() => {
    if (!optional && !value) {
      onChange('17:00')
    }
  }, [optional, onChange, value])

  useEffect(() => {
    if (!optional) {
      return
    }
    if (!value) {
      return
    }
    const nextParsed = parse24hTime(value)
    setOptionalHour(nextParsed.hour)
    setOptionalMinutes(nextParsed.minutes)
  }, [optional, value])

  const handleHourChange = (nextHour: string) => {
    if (optional) {
      setOptionalHour(nextHour)
      if (!nextHour) {
        setOptionalMinutes('')
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
      setOptionalMinutes(nextMinutes)
      if (!selectedHour) {
        return
      }
      if (!nextMinutes) {
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
        {Array.from({ length: 23 }, (_, index) => index + 1)
          .filter((hour) => hour >= minHour)
          .map((hour) => (
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
  const [childLastName, setChildLastName] = useState('')
  const [childBirthDate, setChildBirthDate] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [eventTitle, setEventTitle] = useState('')
  const [eventTitleManuallyEdited, setEventTitleManuallyEdited] = useState(false)
  const [eventDate, setEventDate] = useState(() => format(addDays(new Date(), 1), 'dd/MM/yyyy'))
  const [currentMonth, setCurrentMonth] = useState(() => addDays(new Date(), 1))
  const [startTime, setStartTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')

  const [locationName, setLocationName] = useState('')
  const [locationStreet, setLocationStreet] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationPostal, setLocationPostal] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [organizerCountryCode, setOrganizerCountryCode] = useState('+34')
  const [organizerPhoneNumber, setOrganizerPhoneNumber] = useState('')
  const [organizerProfilePhoneLoaded, setOrganizerProfilePhoneLoaded] = useState(false)
  const [hasSavedProfilePhone, setHasSavedProfilePhone] = useState(false)
  const [savePhoneForFuture, setSavePhoneForFuture] = useState(false)

  const [rsvpDeadlineDays, setRsvpDeadlineDays] = useState('1')
  const [birthdayNumber, setBirthdayNumber] = useState('')
  const [birthdayNumberUserEdited, setBirthdayNumberUserEdited] = useState(false)

  const [giftOption, setGiftOption] = useState<GiftOption>('regalo_libre')
  const [bizumCountryCode, setBizumCountryCode] = useState('+34')
  const [bizumPhoneNumber, setBizumPhoneNumber] = useState('')
  const [showGift, setShowGift] = useState(false)
  const [giftActivated, setGiftActivated] = useState(false)

  const [foodEnabled, setFoodEnabled] = useState(false)
  const [foodOptions, setFoodOptions] = useState<string[]>([''])
  const [showFood, setShowFood] = useState(false)
  const [foodActivated, setFoodActivated] = useState(false)

  const [invitationImageUrl, setInvitationImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const [imageActivated, setImageActivated] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [notesActivated, setNotesActivated] = useState(false)
  const [invitationTheme, setInvitationTheme] = useState<ThemeKey>('yellow')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewThemeClasses: Record<ThemeKey, { card: string; button: string; selection: string }> = {
    yellow: {
      card: 'bg-yellow-50 border-yellow-200',
      button: 'bg-yellow-500 hover:bg-yellow-600',
      selection: 'text-yellow-500 focus:ring-yellow-400',
    },
    pink: {
      card: 'bg-pink-50 border-pink-200',
      button: 'bg-pink-500 hover:bg-pink-600',
      selection: 'text-pink-500 focus:ring-pink-400',
    },
    blue: {
      card: 'bg-blue-50 border-blue-200',
      button: 'bg-blue-500 hover:bg-blue-600',
      selection: 'text-blue-500 focus:ring-blue-400',
    },
    green: {
      card: 'bg-green-50 border-green-200',
      button: 'bg-green-500 hover:bg-green-600',
      selection: 'text-green-500 focus:ring-green-400',
    },
    purple: {
      card: 'bg-purple-50 border-purple-200',
      button: 'bg-purple-500 hover:bg-purple-600',
      selection: 'text-purple-500 focus:ring-purple-400',
    },
  }
  const activePreviewTheme = previewThemeClasses[invitationTheme]
  const themeCalendarClasses: Record<string, string> = {
    yellow: 'bg-yellow-400 text-gray-900',
    pink: 'bg-pink-400 text-white',
    blue: 'bg-blue-400 text-white',
    green: 'bg-green-400 text-white',
    purple: 'bg-purple-400 text-white',
  }

  const hasChildren = children.length > 0

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )
  const isNewChildSelection = selectedChildId === NEW_CHILD_VALUE
  const showChildDetailFields = selectedChildId !== ''
  const parsedEventDate = useMemo(() => formatDisplayToIsoDate(eventDate), [eventDate])
  const selectedEventDate = useMemo(() => {
    if (!parsedEventDate) {
      return undefined
    }
    const [year, month, day] = parsedEventDate.split('-').map((value) => Number.parseInt(value, 10))
    return new Date(year, month - 1, day)
  }, [parsedEventDate])

  const rsvpDeadlineDaysParsed = useMemo(() => {
    const trimmed = rsvpDeadlineDays.trim()
    if (trimmed === '') {
      return null
    }
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isNaN(parsed) ? null : parsed
  }, [rsvpDeadlineDays])

  const rsvpDeadlineHintDeadline =
    parsedEventDate && selectedEventDate !== undefined && rsvpDeadlineDaysParsed !== null
      ? subDays(selectedEventDate, rsvpDeadlineDaysParsed)
      : null

  useEffect(() => {
    if (eventTitleManuallyEdited) {
      return
    }
    const firstName = childName.trim().split(/\s+/)[0]
    const ageTrimmed = birthdayNumber.trim()
    if (!firstName || !ageTrimmed) {
      setEventTitle('')
      return
    }
    const ageParsed = Number.parseInt(ageTrimmed, 10)
    if (Number.isNaN(ageParsed) || ageParsed < 1) {
      setEventTitle('')
      return
    }
    setEventTitle(`Cumple ${ageParsed} de ${firstName}`)
  }, [birthdayNumber, childName, eventTitleManuallyEdited])

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

      const { data: userProfile } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle()

      if (isMounted) {
        setOrganizerProfilePhoneLoaded(true)
        const profilePhone =
          userProfile?.phone != null && String(userProfile.phone).trim() !== ''
            ? String(userProfile.phone).trim()
            : ''
        setHasSavedProfilePhone(profilePhone !== '')
        if (profilePhone !== '') {
          setOrganizerPhoneNumber(profilePhone)
        }
      }

      const { data, error: childrenError } = await supabase
        .from('children')
        .select('id, name, birth_date, last_name')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (isMounted) {
        if (childrenError) {
          setChildren([])
          setError(childrenError.message)
        } else {
          const loadedChildren = (data ?? []) as Child[]
          setChildren(loadedChildren)
          setSelectedChildId('')
          setChildName('')
          setChildLastName('')
          syncChildBirthDateFromDisplayValue('')
        }
        setChildrenLoading(false)
      }
    }

    void loadChildren()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    setBirthdayNumberUserEdited(false)
  }, [birthDay, birthMonth, birthYear, eventDate])

  useEffect(() => {
    if (birthdayNumberUserEdited) {
      return
    }
    if (!birthDay || !birthMonth || !birthYear || !eventDate.trim()) {
      setBirthdayNumber('')
      return
    }
    const parsedBirth = formatDisplayToIsoDate(`${birthDay}/${birthMonth}/${birthYear}`)
    const parsedEvent = formatDisplayToIsoDate(eventDate)
    if (!parsedBirth || !parsedEvent) {
      setBirthdayNumber('')
      return
    }
    const birth = parseIsoDateToLocal(parsedBirth)
    const event = parseIsoDateToLocal(parsedEvent)
    const age = getChildAgeOnEventDate(birth, event)
    if (age < 0 || age > 120) {
      setBirthdayNumber('')
      return
    }
    setBirthdayNumber(String(age))
  }, [birthDay, birthMonth, birthYear, eventDate, birthdayNumberUserEdited])

  const handleChildSelect = (id: string) => {
    setSelectedChildId(id)
    setChildLastName('')

    if (id === '') {
      setChildName('')
      handleChildBirthDateChange('', '', '')
      return
    }

    if (id === NEW_CHILD_VALUE) {
      setChildName('')
      handleChildBirthDateChange('', '', '')
      return
    }

    const child = children.find((item) => item.id === id)
    if (!child) {
      return
    }

    setChildName(getChildDropdownDisplayName(child))
    syncChildBirthDateFromDisplayValue(child.birth_date ? formatIsoToDisplayDate(child.birth_date) : '')
  }

  const handleChildNameChange = (value: string) => {
    setChildName(value)
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

  const handleInvitationImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('La imagen debe ser JPG, PNG o WEBP.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB.')
      event.target.value = ''
      return
    }

    setError(null)
    setImageUploading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'No se pudo obtener tu sesión. Vuelve a iniciar sesión.')
      setImageUploading(false)
      event.target.value = ''
      return
    }

    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setImageUploading(false)
      event.target.value = ''
      return
    }

    const { data } = supabase.storage.from('event-images').getPublicUrl(path)
    setInvitationImageUrl(data.publicUrl)
    setImageUploading(false)
    event.target.value = ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedNombre = childName.trim()
    const trimmedApellido = childLastName.trim()
    const trimmedChildName = isNewChildSelection ? `${trimmedNombre} ${trimmedApellido}`.trim() : trimmedNombre
    const trimmedEventTitle = eventTitle.trim()
    const trimmedLocationName = locationName.trim()
    const trimmedLocationStreet = locationStreet.trim()
    const trimmedLocationCity = locationCity.trim()
    const trimmedLocationPostal = locationPostal.trim()
    const combinedAddress = `${trimmedLocationStreet}, ${trimmedLocationPostal} ${trimmedLocationCity}`
    const trimmedGoogleMapsUrl = googleMapsUrl.trim()
    const trimmedBizumPhoneNumber = bizumPhoneNumber.trim()

    if (selectedChildId === '') {
      setError('Selecciona un hijo/a o la opción Nuevo hijo/a.')
      return
    }

    if (!trimmedNombre) {
      setError('El nombre del cumpleañero es obligatorio.')
      return
    }

    if (isNewChildSelection && !trimmedApellido) {
      setError('El apellido del cumpleañero es obligatorio.')
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
      const birthYearValue = Number.parseInt(parsedChildBirthDate.slice(0, 4), 10)
      const currentYear = new Date().getFullYear()
      if (Number.isNaN(birthYearValue) || birthYearValue < 1926 || birthYearValue > currentYear) {
        setError('La fecha de nacimiento no es válida. El año debe estar entre 1926 y el año actual.')
        return
      }
    }

    if (!trimmedEventTitle || !eventDate || !startTime) {
      setError('Completa título, fecha del evento y hora de inicio.')
      return
    }

    if (!trimmedLocationName || !trimmedLocationStreet || !trimmedLocationCity || !trimmedLocationPostal) {
      setError('El nombre del lugar, la dirección, la ciudad y el código postal son obligatorios.')
      return
    }

    const trimmedOrganizerPhone = organizerPhoneNumber.trim()
    if (!trimmedOrganizerPhone) {
      setError('El número de contacto del organizador es obligatorio.')
      return
    }

    const rsvpTrimmed = rsvpDeadlineDays.trim()
    let rsvpDeadlineDaysValue: number | null = null
    if (rsvpTrimmed !== '') {
      const rsvpDays = Number.parseInt(rsvpTrimmed, 10)
      if (Number.isNaN(rsvpDays) || rsvpDays < 0) {
        setError('Indica un número válido de días para la confirmación, o déjalo vacío.')
        return
      }
      rsvpDeadlineDaysValue = rsvpDays
    }

    let birthdayNumberValue: number | null = null
    const birthdayTrimmed = birthdayNumber.trim()
    if (birthdayTrimmed !== '') {
      const birthdayParsed = Number.parseInt(birthdayTrimmed, 10)
      if (Number.isNaN(birthdayParsed) || birthdayParsed < 1) {
        setError('El número de cumpleaños no es válido.')
        return
      }
      birthdayNumberValue = birthdayParsed
    }

    if (pickupTime && pickupTime <= startTime) {
      setError('La hora de recogida debe ser posterior a la hora de inicio.')
      return
    }

    const isGiftActive = showGift || giftActivated
    if (isGiftActive && giftOption === 'bizum_pool' && !trimmedBizumPhoneNumber) {
      setError('Si eliges Regalo Colectivo, el teléfono es obligatorio.')
      return
    }

    const isFoodActive = showFood || foodActivated
    const normalizedFoodOptions = isFoodActive && foodEnabled
      ? foodOptions.map((option) => option.trim()).filter((option) => option.length > 0)
      : []

    if (isFoodActive && foodEnabled && normalizedFoodOptions.length === 0) {
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

    const fullOrganizerPhone = `${organizerCountryCode}${trimmedOrganizerPhone}`
    if (!hasSavedProfilePhone && savePhoneForFuture) {
      const { error: saveProfilePhoneError } = await supabase
        .from('users')
        .upsert({ id: user.id, phone: fullOrganizerPhone })

      if (saveProfilePhoneError) {
        setError(saveProfilePhoneError.message)
        setLoading(false)
        return
      }
    }

    const publicSlug = generatePublicSlug(trimmedEventTitle)
    console.log('event insert food toggle', { foodEnabled, isFoodActive })
    const query = encodeURIComponent(`${trimmedLocationStreet}, ${trimmedLocationPostal} ${trimmedLocationCity}, Spain`)
    const generatedMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`
    const generatedGoogleMapsUrl = generatedMapsUrl
    const finalGoogleMapsUrl = trimmedGoogleMapsUrl || generatedGoogleMapsUrl

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
        location_address: combinedAddress,
        google_maps_url: finalGoogleMapsUrl,
        gift_option: isGiftActive ? giftOption : 'regalo_libre',
        bizum_phone:
          isGiftActive && giftOption === 'bizum_pool' ? `${bizumCountryCode}${trimmedBizumPhoneNumber}` : null,
        rsvp_deadline_days: rsvpDeadlineDaysValue,
        birthday_number: birthdayNumberValue,
        organizer_phone: fullOrganizerPhone,
        enable_food_options: isFoodActive ? foodEnabled : false,
        organizer_notes: showNotes || notesActivated ? notes.trim() || null : null,
        invitation_theme: invitationTheme,
        invitation_image_url: showImage || imageActivated ? invitationImageUrl : null,
        public_slug: publicSlug,
      })
      .select('id')
      .single()

    if (eventError || !insertedEvent) {
      setError(eventError?.message ?? 'No se pudo crear el evento.')
      setLoading(false)
      return
    }

    if (isFoodActive && foodEnabled && normalizedFoodOptions.length > 0) {
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

    if (isNewChildSelection) {
      const { error: childInsertError } = await supabase.from('children').insert({
        user_id: user.id,
        name: trimmedNombre,
        last_name: trimmedApellido || null,
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

        <section className={`rounded-2xl border p-5 shadow-xl ${activePreviewTheme.card}`}>
          <div className="mb-5">
            <p className="text-sm text-gray-500">Completa los datos y crea tu evento en minutos.</p>
          </div>

          <form
            onSubmit={handleSubmit}
            onInvalidCapture={(e) => {
              ;(e.target as HTMLInputElement | HTMLTextAreaElement).setCustomValidity(
                'Por favor, completa este campo.'
              )
            }}
            onInputCapture={(e) => {
              ;(e.target as HTMLInputElement | HTMLTextAreaElement).setCustomValidity('')
            }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">¿Para quién es el cumple?</h2>

              {childrenLoading ? <p className="text-sm text-gray-500">Cargando hijos...</p> : null}

              {!childrenLoading ? (
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
                    <option value="" className="text-gray-500">
                      Seleccionar
                    </option>
                    {hasChildren
                      ? children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {getChildDropdownDisplayName(child)}
                          </option>
                        ))
                      : null}
                    <option value={NEW_CHILD_VALUE}>Nuevo hijo/a</option>
                  </select>
                </div>
              ) : null}

              {showChildDetailFields ? (
                <>
                  {isNewChildSelection ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
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
                          <label htmlFor="childLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                            Apellido *
                          </label>
                          <input
                            id="childLastName"
                            type="text"
                            value={childLastName}
                            onChange={(event) => setChildLastName(event.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                            placeholder="Ej. García"
                          />
                        </div>
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
                              { length: new Date().getFullYear() - 1926 + 1 },
                              (_, index) => String(new Date().getFullYear() - index)
                            ).map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="birthdayNumber" className="text-sm font-medium text-gray-900">
                            ¿Cuántos cumple? 🎂
                          </label>
                          <input
                            id="birthdayNumber"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={birthdayNumber}
                            onChange={(event) => {
                              setBirthdayNumberUserEdited(true)
                              setBirthdayNumber(event.target.value)
                            }}
                            placeholder="Ej. 5"
                            className="w-20 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="pointer-events-none space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="childBirthDateReadOnly"
                          className="whitespace-nowrap text-sm font-medium text-gray-900"
                        >
                          Fecha de nacimiento
                        </label>
                        <input
                          id="childBirthDateReadOnly"
                          readOnly
                          tabIndex={-1}
                          value={childBirthDate}
                          className="w-32 shrink-0 cursor-default whitespace-nowrap rounded-lg bg-gray-100 px-3 py-1 text-center text-sm text-gray-900 outline-none ring-0 border-0 focus:border-0 focus:ring-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="birthdayNumberReadOnly"
                          className="whitespace-nowrap text-sm font-medium text-gray-900"
                        >
                          ¿Cuántos cumple? 🎂
                        </label>
                        <input
                          id="birthdayNumberReadOnly"
                          readOnly
                          tabIndex={-1}
                          type="text"
                          inputMode="numeric"
                          value={birthdayNumber}
                          className="w-32 shrink-0 cursor-default whitespace-nowrap rounded-lg bg-gray-100 px-3 py-1 text-center text-sm text-gray-900 outline-none ring-0 border-0 focus:border-0 focus:ring-0"
                        />
                      </div>
                    </div>
                  )}
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
                  <div className="w-full rounded-xl border border-gray-200 bg-white p-2 text-gray-900 shadow-sm">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <button
                        type="button"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-1 hover:bg-gray-100 rounded-full"
                      >
                        ‹
                      </button>
                      <span className="font-bold text-gray-900 text-base capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-1 hover:bg-gray-100 rounded-full"
                      >
                        ›
                      </button>
                    </div>
                    <DayPicker
                      mode="single"
                      hideNavigation
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
                      className="w-full text-sm text-gray-900"
                      classNames={{
                        month_caption: 'hidden',
                        month_grid: 'w-full',
                        weeks: 'mt-1',
                        week: 'mt-1',
                        day_button:
                          'hover:bg-yellow-300 rounded-full w-full h-full transition-colors',
                      }}
                      modifiersClassNames={{
                        selected: `${themeCalendarClasses[invitationTheme] ?? themeCalendarClasses.yellow} rounded-full font-semibold`,
                        today: 'font-bold text-gray-900',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 mb-1">
                <div className="flex items-center gap-2 flex-nowrap">
                  <label htmlFor="rsvpDeadlineDays" className="whitespace-nowrap text-sm font-medium text-gray-700">
                    Aceptar respuestas hasta
                  </label>
                  <input
                    id="rsvpDeadlineDays"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={rsvpDeadlineDays}
                    onChange={(event) => setRsvpDeadlineDays(event.target.value)}
                    className="w-12 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                  />
                  <span className="whitespace-nowrap text-sm text-gray-700">
                    {rsvpDeadlineDaysParsed === 1 ? 'día antes del evento,' : 'días antes del evento,'}
                  </span>
                </div>
                {rsvpDeadlineHintDeadline ? (
                  <p className="mt-2 text-sm text-gray-900">
                    es decir, hasta el{' '}
                    <span className="text-gray-500">
                      {format(rsvpDeadlineHintDeadline, "EEEE, d 'de' MMMM.", { locale: es })}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
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
                    <InlineTimePicker
                      value={pickupTime}
                      onChange={setPickupTime}
                      optional
                      minHour={Number.parseInt(startTime.split(':')[0] || '1', 10)}
                    />
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
                <label htmlFor="locationStreet" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Dirección *
                </label>
                <input
                  id="locationStreet"
                  type="text"
                  value={locationStreet}
                  onChange={(event) => setLocationStreet(event.target.value)}
                  required
                  placeholder="Calle y número"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="locationCity" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Ciudad *
                  </label>
                  <input
                    id="locationCity"
                    type="text"
                    value={locationCity}
                    onChange={(event) => setLocationCity(event.target.value)}
                    required
                    placeholder="Ej. Madrid"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>

                <div>
                  <label htmlFor="locationPostal" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Código postal *
                  </label>
                  <input
                    id="locationPostal"
                    type="text"
                    value={locationPostal}
                    onChange={(event) => setLocationPostal(event.target.value)}
                    required
                    placeholder="00000 si no aplica"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>
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
                <p className="mt-1 text-xs text-gray-400">
                  Si lo dejas vacío, generaremos un enlace usando la dirección, ciudad y código postal.
                </p>
              </div>

              <div>
                <label htmlFor="organizerPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Número de contacto del organizador *
                </label>
                <p className="mb-2 text-xs text-gray-500">Los invitados podrán contactarte en este número</p>
                <div className="flex items-center gap-2">
                  <select
                    id="organizerCountryCode"
                    value={organizerCountryCode}
                    onChange={(event) => setOrganizerCountryCode(event.target.value)}
                    className="w-28 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                  >
                    <option value="+34">🇪🇸 +34</option>
                    <option value="+57">🇨🇴 +57</option>
                  </select>
                  <input
                    id="organizerPhone"
                    type="tel"
                    value={organizerPhoneNumber}
                    onChange={(event) => setOrganizerPhoneNumber(event.target.value)}
                    required
                    placeholder="Ej. 612345678"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                  />
                </div>
                {organizerProfilePhoneLoaded && !hasSavedProfilePhone && organizerPhoneNumber.trim() !== '' ? (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={savePhoneForFuture}
                      onChange={(event) => setSavePhoneForFuture(event.target.checked)}
                      className={`h-4 w-4 rounded border-gray-300 ${activePreviewTheme.selection}`}
                    />
                    Guardar este número para futuros eventos
                  </label>
                ) : null}
              </div>
            </div>

            {!showGift ? (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Regalo</p>
                    <p className="text-xs text-gray-400">Añade información de regalo opcional.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGift(true)
                      setGiftActivated(true)
                    }}
                    className="text-sm text-yellow-600 font-medium hover:underline"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-yellow-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Regalo</p>
                  <button
                    type="button"
                    onClick={() => setShowGift(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Quitar
                  </button>
                </div>
                <fieldset className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        name="giftOption"
                        value="regalo_libre"
                        checked={giftOption === 'regalo_libre'}
                        onChange={() => setGiftOption('regalo_libre')}
                        className={`h-4 w-4 border-gray-300 ${activePreviewTheme.selection}`}
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
                        className={`h-4 w-4 border-gray-300 ${activePreviewTheme.selection}`}
                      />
                      Regalo compartido
                    </label>
                  </div>
                  {giftOption === 'bizum_pool' ? (
                    <div className="flex items-center gap-2">
                      <div>
                        <label htmlFor="bizumCountryCode" className="mb-1.5 block text-sm font-medium text-gray-900">
                          País
                        </label>
                        <select
                          id="bizumCountryCode"
                          value={bizumCountryCode}
                          onChange={(event) => setBizumCountryCode(event.target.value)}
                          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
                        >
                          <option value="+34">🇪🇸 +34</option>
                          <option value="+57">🇨🇴 +57</option>
                        </select>
                      </div>
                      <div className="flex-1">
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
            )}

            {!showFood ? (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Opciones de comida</p>
                    <p className="text-xs text-gray-400">Añade opciones de comida si lo necesitas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFood(true)
                      setFoodActivated(true)
                    }}
                    className="text-sm text-yellow-600 font-medium hover:underline"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-yellow-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Opciones de comida</p>
                  <button
                    type="button"
                    onClick={() => setShowFood(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Quitar
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={foodEnabled}
                    onChange={(event) => toggleFoodOptions(event.target.checked)}
                    className={`h-4 w-4 rounded border-gray-300 ${activePreviewTheme.selection}`}
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
                          placeholder={index === 0 ? 'Ej. Pizza' : `Opción ${index + 1}`}
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
            )}

            {!showImage ? (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Imagen de la invitación</p>
                    <p className="text-xs text-gray-400">
                      Puedes subir una imagen creada en Canva, ChatGPT u otra herramienta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowImage(true)
                      setImageActivated(true)
                    }}
                    className="text-sm text-yellow-600 font-medium hover:underline"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-yellow-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Imagen de la invitación</p>
                  <button
                    type="button"
                    onClick={() => setShowImage(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Quitar
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  Puedes subir una imagen creada en Canva, ChatGPT u otra herramienta.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleInvitationImageChange}
                  disabled={imageUploading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {imageUploading ? <p className="text-sm text-gray-500">Subiendo imagen...</p> : null}
                {invitationImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={invitationImageUrl}
                      alt="Invitación"
                      className="w-full rounded-xl object-cover max-h-64"
                    />
                    <button
                      type="button"
                      onClick={() => setInvitationImageUrl(null)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Quitar imagen
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {!showNotes ? (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Notas para los invitados</p>
                    <p className="text-xs text-gray-400">Añade un mensaje opcional para tus invitados.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotes(true)
                      setNotesActivated(true)
                    }}
                    className="text-sm text-yellow-600 font-medium hover:underline"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-yellow-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Notas para los invitados</p>
                  <button
                    type="button"
                    onClick={() => setShowNotes(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Quitar
                  </button>
                </div>
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
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Tonalidad de la invitación
              </label>
              <p className="text-xs text-gray-400">Elige el estilo visual de tu invitación.</p>
              <div className="flex justify-center items-center gap-3 py-2">
                {(Object.entries(themes) as [ThemeKey, typeof themes.yellow][]).map(([key, theme]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={theme.label}
                    title={theme.label}
                    onClick={() => setInvitationTheme(key)}
                    className={`w-7 h-7 rounded-full cursor-pointer transition ${theme.swatch} ${
                      invitationTheme === key
                        ? 'ring-2 ring-offset-2 ring-gray-800'
                        : 'ring-1 ring-offset-1 ring-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 transition disabled:cursor-not-allowed disabled:opacity-60 ${activePreviewTheme.button}`}
            >
              {loading ? 'Creando evento...' : 'Crear evento'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
