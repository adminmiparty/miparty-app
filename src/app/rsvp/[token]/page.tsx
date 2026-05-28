'use client'

import AppNav from '@/components/AppNav'
import Link from 'next/link'
import { subDays } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MetaPixelPageView from '@/components/MetaPixelPageView'
import { brand } from '@/lib/brand'
import { sanitizePhoneInput, validatePhoneNumber } from '@/lib/phone'
import { trackLead, trackRsvpAttendanceLead } from '@/lib/meta-pixel'
import { trackLead as trackTikTokLead } from '@/lib/tiktok-pixel'
import { isActiveEventStatus } from '@/lib/eventLifecycle'
import { getTheme } from '@/lib/themes'

type AttendanceStatus = 'confirmed' | 'declined' | 'maybe'

type ConversionModalView = 'signup' | 'login'

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
  organizer_phone: string | null
  status?: string | null
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

function composeBirthDateIso(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) return null
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

function formatRsvpConfirmacionesLineFull(eventDate: string, daysBefore: number) {
  const [yearPart, monthPart, dayPart] = eventDate.split('-').map((value) => Number.parseInt(value, 10))
  const eventDay = new Date(yearPart, monthPart - 1, dayPart)
  const deadline = subDays(eventDay, daysBefore)
  return capitalizeFirst(format(deadline, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))
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

function digitsForWhatsApp(phone: string) {
  return phone.replace(/\D/g, '')
}

function organizerPhoneLinkClass(themeKey: string | null) {
  if (themeKey === 'pink') return 'text-pink-600 underline decoration-pink-400/40 underline-offset-2 hover:text-pink-800'
  if (themeKey === 'blue') return 'text-blue-600 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-800'
  if (themeKey === 'green') return 'text-green-700 underline decoration-green-600/40 underline-offset-2 hover:text-green-900'
  if (themeKey === 'purple') return 'text-purple-600 underline decoration-purple-400/40 underline-offset-2 hover:text-purple-800'
  return 'text-yellow-700 underline decoration-yellow-600/40 underline-offset-2 hover:text-yellow-900'
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
  const token = (
    typeof params?.token === 'string'
      ? params.token
      : Array.isArray(params?.token)
        ? (params.token[0] ?? '')
        : ''
  ).trim()

  const supabase = createClient()

  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready' | 'notfound'>('loading')
  const [themeKey, setThemeKey] = useState<string | null>(null)
  const [eventData, setEventData] = useState<LoadedEventForEdit | null>(null)
  const [baselinePayload, setBaselinePayload] = useState<NormalizedRsvpPayload | null>(null)
  const [foodOptions, setFoodOptions] = useState<{ label: string }[]>([])
  const [hasFoodOptions, setHasFoodOptions] = useState(false)
  /** Details form card hidden until guest taps an attendance option in Card 2 */
  const [detailsFormVisible, setDetailsFormVisible] = useState(false)

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
  /** Success banner after save — slides in then auto-dismiss */
  const [saveToastVisible, setSaveToastVisible] = useState(false)
  const [saveToastEntered, setSaveToastEntered] = useState(false)
  const saveToastDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveToastUnmountRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Shown once a save succeeds — subtle footer with edit URL + copy */
  const [hasSavedOnce, setHasSavedOnce] = useState(false)
  const [savedEditCopyDone, setSavedEditCopyDone] = useState(false)
  const savedEditCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [parentDialOpen, setParentDialOpen] = useState(false)
  const parentDialRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  const [showEmailSignup, setShowEmailSignup] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [signupToggle, setSignupToggle] = useState(false)
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [conversionModalView, setConversionModalView] = useState<ConversionModalView>('signup')
  const [modalSignupEmail, setModalSignupEmail] = useState('')
  const [modalSignupPassword, setModalSignupPassword] = useState('')
  const [modalLoginEmail, setModalLoginEmail] = useState('')
  const [modalLoginPassword, setModalLoginPassword] = useState('')
  const [showModalSignupPassword, setShowModalSignupPassword] = useState(false)
  const [showModalLoginPassword, setShowModalLoginPassword] = useState(false)
  const [modalShowEmailFields, setModalShowEmailFields] = useState(false)
  const [signupFlowError, setSignupFlowError] = useState<string | null>(null)
  const [showModalForgotPassword, setShowModalForgotPassword] = useState(false)
  const [modalForgotEmail, setModalForgotEmail] = useState('')
  const [modalForgotSent, setModalForgotSent] = useState(false)
  const [modalForgotError, setModalForgotError] = useState('')
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [welcomeModalView, setWelcomeModalView] = useState<'welcome' | 'success'>('welcome')
  const [welcomeFirstName, setWelcomeFirstName] = useState('')
  const [welcomeLastName, setWelcomeLastName] = useState('')
  const [welcomePhone, setWelcomePhone] = useState('')
  const [welcomePhoneCode, setWelcomePhoneCode] = useState('+34')
  const [welcomeCustomDialCode, setWelcomeCustomDialCode] = useState('')
  const [welcomeBirthDay, setWelcomeBirthDay] = useState('')
  const [welcomeBirthMonth, setWelcomeBirthMonth] = useState('')
  const [welcomeBirthYear, setWelcomeBirthYear] = useState('')
  const [welcomeChildFirstName, setWelcomeChildFirstName] = useState('')
  const [welcomeChildLastName, setWelcomeChildLastName] = useState('')
  const [welcomeChildBirthDay, setWelcomeChildBirthDay] = useState('')
  const [welcomeChildBirthMonth, setWelcomeChildBirthMonth] = useState('')
  const [welcomeChildBirthYear, setWelcomeChildBirthYear] = useState('')
  const [showWelcomeSecondChild, setShowWelcomeSecondChild] = useState(false)
  const [welcomeChild2FirstName, setWelcomeChild2FirstName] = useState('')
  const [welcomeChild2LastName, setWelcomeChild2LastName] = useState('')
  const [welcomeChild2BirthDay, setWelcomeChild2BirthDay] = useState('')
  const [welcomeChild2BirthMonth, setWelcomeChild2BirthMonth] = useState('')
  const [welcomeChild2BirthYear, setWelcomeChild2BirthYear] = useState('')
  const [welcomeChildBirthError, setWelcomeChildBirthError] = useState(false)

  const welcomeBirthYears = useMemo(
    () => Array.from({ length: 101 }, (_, index) => String(new Date().getFullYear() - index)),
    [],
  )

  const prefillAndOpenWelcomeModal = async () => {
    const { data: rsvpData } = await supabase
      .from('rsvps')
      .select('guest_parent_name, guest_parent_phone, child_name, guest_parent_email')
      .eq('edit_token', token)
      .maybeSingle()

    const nameParts = (rsvpData?.guest_parent_name || '').trim().split(/\s+/).filter(Boolean)
    setWelcomeFirstName(nameParts[0] || '')
    setWelcomeLastName(nameParts.slice(1).join(' ') || '')

    const childParts = (rsvpData?.child_name || '').trim().split(/\s+/).filter(Boolean)
    const rsvpChildFirst = childParts[0] || ''
    const rsvpChildLast = childParts.slice(1).join(' ') || ''
    setWelcomeChildFirstName(rsvpChildFirst)
    setWelcomeChildLastName(rsvpChildLast)
    setWelcomeChildBirthDay('')
    setWelcomeChildBirthMonth('')
    setWelcomeChildBirthYear('')
    setShowWelcomeSecondChild(false)
    setWelcomeChild2FirstName('')
    setWelcomeChild2LastName('')
    setWelcomeChild2BirthDay('')
    setWelcomeChild2BirthMonth('')
    setWelcomeChild2BirthYear('')
    setWelcomeChildBirthError(false)
    setWelcomeBirthDay('')
    setWelcomeBirthMonth('')
    setWelcomeBirthYear('')

    const fullPhone = (rsvpData?.guest_parent_phone || '').trim()
    if (fullPhone) {
      const phoneParts = splitGuestPhone(fullPhone)
      setWelcomePhoneCode(phoneParts.countryCode)
      setWelcomeCustomDialCode(phoneParts.customCode)
      setWelcomePhone(phoneParts.number)
    } else {
      setWelcomePhoneCode('+34')
      setWelcomeCustomDialCode('')
      setWelcomePhone('')
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: recentChild } = await supabase
        .from('children')
        .select('id, name, last_name, birth_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentChild) {
        setWelcomeChildFirstName(recentChild.name ?? rsvpChildFirst)
        setWelcomeChildLastName(recentChild.last_name || rsvpChildLast)
        if (recentChild.birth_date) {
          const [year, month, day] = String(recentChild.birth_date).split('T')[0].split('-')
          setWelcomeChildBirthYear(year ?? '')
          setWelcomeChildBirthMonth(month ?? '')
          setWelcomeChildBirthDay(day ?? '')
        }
      }
    }

    setWelcomeModalView('welcome')
    setShowWelcomeModal(true)
  }

  const validateWelcomeChildBirthDate = () => {
    const hasComplete =
      Boolean(welcomeChildBirthDay) && Boolean(welcomeChildBirthMonth) && Boolean(welcomeChildBirthYear)
    if (!hasComplete) {
      setWelcomeChildBirthError(true)
      return false
    }
    setWelcomeChildBirthError(false)
    return true
  }

  const persistWelcomeProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const welcomeDial = resolveDialCode(welcomePhoneCode, welcomeCustomDialCode)
    const welcomeFullPhone =
      welcomePhone.trim().length > 0 ? `${welcomeDial}${welcomePhone.replace(/\s/g, '')}` : null
    const welcomeBirthDate = composeBirthDateIso(welcomeBirthDay, welcomeBirthMonth, welcomeBirthYear)

    await supabase.from('users').upsert({
      id: user.id,
      first_name: welcomeFirstName.trim() || null,
      last_name: welcomeLastName.trim() || null,
      phone: welcomeFullPhone,
      birth_date: welcomeBirthDate,
      signup_source: 'rsvp_edit_page',
    })

    const childBirthDate =
      welcomeChildBirthDay && welcomeChildBirthMonth && welcomeChildBirthYear
        ? `${welcomeChildBirthYear}-${String(welcomeChildBirthMonth).padStart(2, '0')}-${String(welcomeChildBirthDay).padStart(2, '0')}`
        : null

    if (childBirthDate) {
      const { data: existingChildren } = await supabase
        .from('children')
        .select('id, name, birth_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const existingChild = existingChildren?.[0] || null
      if (existingChild) {
        await supabase
          .from('children')
          .update({
            last_name: welcomeChildLastName.trim() || null,
            birth_date: childBirthDate,
          })
          .eq('id', existingChild.id)
      } else {
        await supabase.from('children').insert({
          user_id: user.id,
          name: welcomeChildFirstName.trim(),
          last_name: welcomeChildLastName.trim() || null,
          birth_date: childBirthDate,
        })
      }
    }

    const child2BirthDate =
      welcomeChild2BirthYear && welcomeChild2BirthMonth && welcomeChild2BirthDay
        ? `${welcomeChild2BirthYear}-${welcomeChild2BirthMonth.padStart(2, '0')}-${welcomeChild2BirthDay.padStart(2, '0')}`
        : null

    if (child2BirthDate && welcomeChild2FirstName.trim()) {
      await supabase.from('children').insert({
        user_id: user.id,
        name: welcomeChild2FirstName.trim(),
        last_name: welcomeChild2LastName.trim() || null,
        birth_date: child2BirthDate,
      })
    }
  }

  const handleSaveWelcomeProfile = async () => {
    if (!validateWelcomeChildBirthDate()) return
    await persistWelcomeProfile()
    setWelcomeModalView('success')
  }

  const handleSkipWelcomeProfile = async () => {
    if (!validateWelcomeChildBirthDate()) return
    await persistWelcomeProfile()
    setWelcomeModalView('success')
  }

  const resolvedThemeKey: ThemeKeyType =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const activeTheme = getTheme(resolvedThemeKey)
  const inputFocusClass = inputFocusMap[resolvedThemeKey]

  useEffect(() => {
    const sb = createClient()
    void sb.auth.getUser().then(({ data }) => {
      console.log('Auth user on rsvp page:', data.user)
      if (data.user) setIsLoggedIn(true)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return
      if (token) {
        await sb.from('rsvps').update({ user_id: session.user.id }).eq('edit_token', token)
      }
      const googleFullName =
        typeof session.user.user_metadata?.full_name === 'string'
          ? session.user.user_metadata.full_name
          : null
      const nameParts = googleFullName?.split(/\s+/).filter(Boolean) ?? []
      await sb.from('users').upsert({
        id: session.user.id,
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(' ') || null,
        signup_source: 'rsvp_edit_page',
      })
      setIsLoggedIn(true)
      setShowConversionModal(false)
      void prefillAndOpenWelcomeModal()
    })

    return () => subscription.unsubscribe()
  }, [token])

  useEffect(() => {
    if (!showConversionModal || conversionModalView !== 'signup') return
    trackLead('rsvp_conversion_modal_shown')
    trackTikTokLead('rsvp_conversion_modal_shown')
  }, [showConversionModal, conversionModalView])

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
      if (saveToastDismissRef.current != null) clearTimeout(saveToastDismissRef.current)
      if (saveToastUnmountRef.current != null) clearTimeout(saveToastUnmountRef.current)
      if (savedEditCopyTimeoutRef.current != null) clearTimeout(savedEditCopyTimeoutRef.current)
    }
  }, [])

  function showSavedResponseToast() {
    if (saveToastDismissRef.current != null) {
      clearTimeout(saveToastDismissRef.current)
      saveToastDismissRef.current = null
    }
    if (saveToastUnmountRef.current != null) {
      clearTimeout(saveToastUnmountRef.current)
      saveToastUnmountRef.current = null
    }

    const scheduleDismiss = () => {
      saveToastDismissRef.current = setTimeout(() => {
        saveToastDismissRef.current = null
        setSaveToastEntered(false)
        saveToastUnmountRef.current = setTimeout(() => {
          saveToastUnmountRef.current = null
          setSaveToastVisible(false)
        }, 280)
      }, 3000)
    }

    if (saveToastVisible) {
      scheduleDismiss()
      return
    }

    setSaveToastVisible(true)
    setSaveToastEntered(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSaveToastEntered(true))
    })
    scheduleDismiss()
  }

  function syncFormFromPayload(saved: NormalizedRsvpPayload) {
    const { first, last } = splitChildNameForForm(saved.child_name ?? '')
    setChildName(first)
    setChildLastName(last)
    setParentName(saved.guest_parent_name)
    setParentEmail(saved.guest_parent_email ?? '')
    const dial = splitGuestPhone(saved.guest_parent_phone)
    setParentCountryCode(dial.countryCode)
    setParentCustomCode(dial.customCode)
    setParentPhoneNumber(dial.number)
    setAttendance(saved.attendance_status)
    let foodPref = saved.food_preference?.trim() ?? ''
    if (
      saved.attendance_status === 'confirmed' &&
      hasFoodOptions &&
      foodOptions.length === 1 &&
      !foodPref
    ) {
      foodPref = foodOptions[0]?.label ?? ''
    }
    setFoodPreference(foodPref)
    setAllergyNotes(saved.allergy_notes?.trim() ?? '')
    setExtraNotes(saved.extra_notes?.trim() ?? '')
  }

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
          'id, title, child_name, birthday_number, event_date, start_time, pickup_time, location_name, location_address, google_maps_url, gift_option, bizum_phone, organizer_phone, invitation_theme, enable_food_options, organizer_notes, rsvp_deadline_days, public_slug, invitation_image_url, invitation_image_fit, invitation_image_position, invitation_image_zoom, status'
        )
        .eq('id', rsvpData.event_id)
        .maybeSingle()

      if (cancelled) return

      if (!eventRow?.id) {
        setLoadState('notfound')
        return
      }

      if (!isActiveEventStatus((eventRow as LoadedEventForEdit).status)) {
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
        setDetailsFormVisible(false)
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
    if (loadState !== 'ready' || !detailsFormVisible || !messageRef.current) return
    const el = messageRef.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [loadState, detailsFormVisible, extraNotes])

  const placeholderText = useMemo(() => {
    if (attendance === 'confirmed') return 'Ej. ¡Genial! Irá encantado/a'
    if (attendance === 'declined') return 'Ej. Lo siento, esta vez no podremos ir'
    return 'Ej. Tengo que mirarlo y te confirmo en cuanto pueda'
  }, [attendance])

  const hasFormChanges = useMemo(() => {
    if (!baselinePayload || !attendance) return false
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

  const rsvpDeadlineLabel = useMemo(() => {
    if (!eventData) return null
    const d = eventData.rsvp_deadline_days
    if (d == null || d <= 0 || !Number.isFinite(d)) return null
    return formatRsvpDeadlineLabel(eventData.event_date, d)
  }, [eventData])

  const confirmacionesLine = useMemo(() => {
    if (!eventData) return null
    const d = eventData.rsvp_deadline_days
    if (d != null && d > 0 && Number.isFinite(d)) {
      return `Confirmaciones hasta el ${formatRsvpConfirmacionesLineFull(eventData.event_date, d)}`
    }
    return 'Confirmaciones hasta el día del evento'
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

  /** Card 2: pick attendance (always selects; reveals details card) */
  function handleAttendancePickFromSummary(nextStatus: AttendanceStatus) {
    setAttendance(nextStatus)
    setDetailsFormVisible(true)
  }

  const handleGoogleSignup = async () => {
    sessionStorage.setItem('miparty_oauth_pending', '1')
    sessionStorage.setItem('miparty_signup_source', 'rsvp_toggle')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }

  const handleConversionGoogleSignup = async () => {
    sessionStorage.setItem('miparty_oauth_pending', '1')
    sessionStorage.setItem('miparty_signup_source', 'rsvp_modal')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }

  const handleEmailSignupModal = async () => {
    setSignupFlowError(null)
    const email = modalSignupEmail.trim()
    const password = modalSignupPassword
    if (!email || !password) {
      setSignupFlowError('Introduce email y contraseña.')
      return
    }
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: parentName.trim(),
        },
      },
    })
    if (signErr) {
      setSignupFlowError(signErr.message)
      return
    }
    const uid = data.user?.id ?? data.session?.user?.id
    if (!uid) {
      setSignupFlowError('No se pudo completar el registro. Inténtalo de nuevo.')
      return
    }
    const trimmedParentName = parentName.trim()
    const nameParts = trimmedParentName.split(/\s+/).filter(Boolean)
    await supabase.from('users').upsert({
      id: uid,
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(' ') || null,
      signup_source: 'rsvp_modal',
    })
    await supabase.from('rsvps').update({ user_id: uid }).eq('edit_token', token)
    setIsLoggedIn(true)
    setShowConversionModal(false)
    await prefillAndOpenWelcomeModal()
  }

  const handleLoginAndLinkModal = async () => {
    setSignupFlowError(null)
    const email = modalLoginEmail.trim()
    const password = modalLoginPassword
    if (!email || !password) {
      setSignupFlowError('Introduce email y contraseña.')
      return
    }
    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signErr) {
      setSignupFlowError(signErr.message)
      return
    }
    if (!data.user) {
      setSignupFlowError('No se pudo iniciar sesión.')
      return
    }
    await supabase.from('rsvps').update({ user_id: data.user.id }).eq('edit_token', token)
    setIsLoggedIn(true)
    setShowConversionModal(false)
    await prefillAndOpenWelcomeModal()
  }

  const handleModalForgotPassword = async () => {
    setModalForgotError('')
    if (!modalForgotEmail.trim()) {
      setModalForgotError('Introduce tu email')
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(modalForgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (resetError) {
      setModalForgotError('No se pudo enviar el enlace. Inténtalo de nuevo.')
      return
    }
    setModalForgotSent(true)
  }

  const renderGoogleSignupButton = (onGoogleClick: () => void) => (
    <button
      type="button"
      onClick={() => void onGoogleClick()}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continuar con Google
    </button>
  )

  const handleEmailSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    })
    if (error) {
      alert(error.message)
      return
    }
    const uid = data.user?.id ?? data.session?.user?.id
    if (uid) {
      const trimmedParentName = parentName.trim()
      const nameParts = trimmedParentName.split(/\s+/).filter(Boolean)
      await supabase.from('users').upsert({
        id: uid,
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(' ') || null,
        signup_source: 'rsvp_edit_page',
      })
      await supabase.from('rsvps').update({ user_id: uid }).eq('edit_token', token)
      setIsLoggedIn(true)
      await prefillAndOpenWelcomeModal()
    }
  }

  const renderSignupBanner = () => {
    if (isLoggedIn || signupToggle) return null
    return (
      <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
        <p className="mb-3 text-center text-sm text-gray-600">
          ¿Tú también organizas fiestas? Regístrate y gestiona todo desde un solo lugar.
        </p>
        {renderGoogleSignupButton(handleGoogleSignup)}
        <div className="my-2 flex items-center gap-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
        <button
          type="button"
          onClick={() => setShowEmailSignup(!showEmailSignup)}
          className="w-full text-sm text-gray-500 underline hover:text-gray-700"
        >
          Registrarse con email
        </button>
        {showEmailSignup ? (
          <div className="mt-2 space-y-2">
            <input
              type="email"
              placeholder="tu@email.com"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="relative">
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              >
                {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                trackLead('rsvp_crear_cuenta')
                trackTikTokLead('rsvp_crear_cuenta')
                void handleEmailSignup()
              }}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white"
            >
              Crear cuenta
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const copySavedEditLink = async () => {
    if (!token) return
    const url = `https://miparty.net/rsvp/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setSavedEditCopyDone(true)
      if (savedEditCopyTimeoutRef.current != null) clearTimeout(savedEditCopyTimeoutRef.current)
      savedEditCopyTimeoutRef.current = setTimeout(() => {
        setSavedEditCopyDone(false)
        savedEditCopyTimeoutRef.current = null
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

    const trimmedParentName = parentName.trim()
    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    const trimmedParentEmail = parentEmail.trim()
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
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

    const phoneValidation = validatePhoneNumber(parentPhoneNumber, parentCountryCode)
    if (!phoneValidation.valid && phoneValidation.error !== null) {
      setError(phoneValidation.error)
      return
    }

    const combinedChildName =
      trimmedChildLastName.length > 0 ? `${trimmedChildName} ${trimmedChildLastName}` : trimmedChildName
    const finalPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''

    const foodPrefForDb = attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null
    const allergyForDb =
      attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null

    console.log('updating token:', token)

    setLoading(true)
    const { error: updateError } = await supabase
      .from('rsvps')
      .update({
        attendance_status: attendance,
        child_name: combinedChildName,
        guest_parent_name: trimmedParentName,
        guest_parent_email: trimmedParentEmail || null,
        guest_parent_phone: finalPhone || null,
        food_preference: foodPrefForDb,
        allergy_notes: allergyForDb,
        extra_notes: trimmedExtraNotes || null,
      })
      .eq('edit_token', token)

    console.log('update error:', updateError)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
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

    setBaselinePayload(payload)
    syncFormFromPayload(payload)
    setDetailsFormVisible(false)
    showSavedResponseToast()
    setHasSavedOnce(true)
    trackRsvpAttendanceLead(attendance)
    if (!isLoggedIn && !signupToggle) {
      setConversionModalView('signup')
      setModalShowEmailFields(false)
      setSignupFlowError(null)
      setShowConversionModal(true)
    }
    setLoading(false)
  }

  const rsvpTopNav = <AppNav brandHref="/" />
  const eventTitle = eventData?.title?.trim() || 'este evento'

  const neutralPageBg = 'from-white to-white'
  const pageBg = loadState === 'ready' ? getTheme(resolvedThemeKey).pageBg : neutralPageBg

  if (loadState === 'loading') {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${neutralPageBg}`} aria-busy="true">
        {rsvpTopNav}
      </main>
    )
  }

  if (loadState === 'notfound') {
    return (
      <main className={`min-h-screen bg-gradient-to-b ${neutralPageBg}`}>
        {rsvpTopNav}
        <div className="px-4 py-10">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <p className="text-center text-sm font-medium text-gray-900">Este enlace no es válido o ha expirado.</p>
            <p className="mt-2 text-center text-xs text-gray-500">
              Pide al organizador que te reenvíe la invitación para responder de nuevo.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const invitationFitClass =
    eventData?.invitation_image_fit === 'cover' ? 'object-cover' : 'object-contain bg-gray-50'

  function savedResponseBadgeClasses(status: AttendanceStatus) {
    if (status === 'confirmed')
      return 'border-emerald-300 bg-emerald-100 text-emerald-900'
    if (status === 'declined') return 'border-red-200 bg-red-50 text-red-800'
    return 'border-amber-200 bg-amber-100 text-amber-950'
  }

  const renderPostConversionModal = () => {
    if (!showConversionModal) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
        <div className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            type="button"
            className="absolute right-3 top-2 text-2xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="Cerrar"
            onClick={() => setShowConversionModal(false)}
          >
            ×
          </button>

          {conversionModalView === 'signup' ? (
            <div className="pt-2">
              <p className="text-center text-2xl" aria-hidden>
                🎉
              </p>
              <h3 className="mt-2 text-center text-lg font-bold text-gray-900">
                ¡Has guardado tu respuesta para el {eventTitle}!
              </h3>
              <p className="mt-2 text-center text-sm text-gray-600">Pero antes, crea tu cuenta gratis y:</p>
              <ul className="mt-3 space-y-3">
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-base leading-none text-green-600" aria-hidden>
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Olvídate del caos de los grupos de WhatsApp</p>
                    <p className="mt-0.5 text-xs text-gray-500">Todas las confirmaciones en un solo lugar</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-base leading-none text-green-600" aria-hidden>
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Ten claridad de quién viene</p>
                    <p className="mt-0.5 text-xs text-gray-500">Sin perseguir a nadie el día antes</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-base leading-none text-green-600" aria-hidden>
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Alergias e intolerancias bajo control</p>
                    <p className="mt-0.5 text-xs text-gray-500">Nunca más un susto en la mesa</p>
                  </div>
                </li>
                <li className="rounded-lg border border-yellow-200 bg-yellow-50 p-2">
                  <div className="flex gap-2">
                    <span className="mt-0.5 shrink-0 text-base leading-none text-green-600" aria-hidden>
                      ✓
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-yellow-800">
                        Tu primer evento completamente gratis 🎁
                      </p>
                      <p className="mt-0.5 text-xs text-yellow-600">Sin tarjeta de crédito. Sin compromisos.</p>
                    </div>
                  </div>
                </li>
              </ul>
              <div className="mt-4">{renderGoogleSignupButton(handleConversionGoogleSignup)}</div>
              <p className="mt-2 text-center text-xs text-gray-500">o</p>
              {!modalShowEmailFields ? (
                <button
                  type="button"
                  onClick={() => setModalShowEmailFields(true)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Usar mi email
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={modalSignupEmail}
                    onChange={(e) => setModalSignupEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                  <div className="relative">
                    <input
                      type={showModalSignupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Contraseña"
                      value={modalSignupPassword}
                      onChange={(e) => setModalSignupPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalSignupPassword(!showModalSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showModalSignupPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackLead('rsvp_conversion_modal_crear_cuenta')
                      trackTikTokLead('rsvp_conversion_modal_crear_cuenta')
                      void handleEmailSignupModal()
                    }}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Crear cuenta
                  </button>
                </div>
              )}
              <div className="mt-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConversionModalView('login')
                    setSignupFlowError(null)
                  }}
                  className="text-sm text-gray-500 underline hover:text-gray-700"
                >
                  Ya tengo cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setShowConversionModal(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  No gracias, continuar
                </button>
              </div>
            </div>
          ) : null}

          {conversionModalView === 'login' ? (
            <div className="pt-2">
              <h3 className="text-center text-lg font-bold text-gray-900">Inicia sesión</h3>
              <p className="mt-1 text-center text-sm text-gray-600">Vincula tu confirmación a tu cuenta</p>
              {showModalForgotPassword ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Escribe tu email y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={modalForgotEmail}
                    onChange={(e) => setModalForgotEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                  {modalForgotError ? <p className="text-xs text-red-500">{modalForgotError}</p> : null}
                  {modalForgotSent ? (
                    <p className="text-center text-sm text-green-600">
                      ✅ Enlace enviado. Revisa tu bandeja de entrada.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleModalForgotPassword()}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
                    >
                      Enviar enlace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowModalForgotPassword(false)
                      setModalForgotSent(false)
                      setModalForgotError('')
                      setModalForgotEmail('')
                    }}
                    className="w-full text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {renderGoogleSignupButton(handleConversionGoogleSignup)}
                  <p className="text-center text-xs text-gray-500">o</p>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={modalLoginEmail}
                    onChange={(e) => setModalLoginEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                  <div className="relative">
                    <input
                      type={showModalLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Contraseña"
                      value={modalLoginPassword}
                      onChange={(e) => setModalLoginPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalLoginPassword(!showModalLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showModalLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModalForgotPassword(true)}
                    className="mt-1 w-full text-right text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoginAndLinkModal()}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Iniciar sesión
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setConversionModalView('signup')
                  setSignupFlowError(null)
                }}
                className="mt-3 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </button>
            </div>
          ) : null}

          {signupFlowError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-center text-xs text-red-700">
              {signupFlowError}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  const renderWelcomeModal = () => {
    if (!showWelcomeModal) return null

    const displayFirstName = welcomeFirstName.trim() || 'ahí'
    const childProfileName =
      [welcomeChildFirstName.trim(), welcomeChildLastName.trim()].filter(Boolean).join(' ') || 'tu hijo/a'

    if (welcomeModalView === 'success') {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowWelcomeModal(false)}
              className="absolute right-3 top-2 text-2xl leading-none text-gray-400 hover:text-gray-700"
              aria-label="Cerrar"
            >
              ×
            </button>
            <p className="text-center text-4xl" aria-hidden>
              🎉
            </p>
            <h3 className="mt-2 text-center text-xl font-bold text-gray-900">
              ¡Bienvenido/a, {displayFirstName}! 🎉
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              Tu cuenta ha sido creada y tu perfil guardado. Ahora puedes organizar tus propios cumpleaños y
              gestionar confirmaciones desde un solo lugar.
            </p>
            <Link
              href="/dashboard"
              className={`mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
            >
              Ir a mi perfil →
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            type="button"
            onClick={() => setShowWelcomeModal(false)}
            className="absolute right-3 top-2 text-2xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="Cerrar"
          >
            ×
          </button>
          <h2 className="pr-8 text-lg font-bold text-gray-900">¡Bienvenido/a, {displayFirstName}! 🎉</h2>
          <p className="mt-2 text-sm text-gray-600">
            Tu cuenta ha sido creada. Completa tu perfil para una mejor experiencia.
          </p>
          <p className="mt-4 text-sm font-semibold text-gray-900">Tus datos</p>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="welcomeFirstName" className="text-xs font-medium text-gray-600">
                  Nombre
                </label>
                <input
                  id="welcomeFirstName"
                  type="text"
                  value={welcomeFirstName}
                  onChange={(e) => setWelcomeFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label htmlFor="welcomeLastName" className="text-xs font-medium text-gray-600">
                  Apellido(s)
                </label>
                <input
                  id="welcomeLastName"
                  type="text"
                  value={welcomeLastName}
                  onChange={(e) => setWelcomeLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
            <div>
              <label htmlFor="welcomePhone" className="mb-1.5 block text-sm font-medium text-gray-900">
                Teléfono
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={welcomePhoneCode}
                  onChange={(e) => setWelcomePhoneCode(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Prefijo"
                >
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+57">🇨🇴 +57</option>
                  <option value="otro">✏️ Otro</option>
                </select>
                {welcomePhoneCode === 'otro' ? (
                  <input
                    type="text"
                    inputMode="tel"
                    value={welcomeCustomDialCode}
                    onChange={(e) => setWelcomeCustomDialCode(sanitizeDialPrefix(e.target.value))}
                    maxLength={5}
                    placeholder="+00"
                    aria-label="Prefijo internacional"
                    className="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                ) : null}
                <input
                  id="welcomePhone"
                  type="tel"
                  inputMode="tel"
                  value={welcomePhone}
                  onChange={(e) => setWelcomePhone(e.target.value)}
                  placeholder="Ej. 612345678"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900">Tu fecha de nacimiento</span>
                <span className="text-xs text-gray-400">(opcional)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={welcomeBirthDay}
                  onChange={(e) => setWelcomeBirthDay(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Día"
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <select
                  value={welcomeBirthMonth}
                  onChange={(e) => setWelcomeBirthMonth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Mes"
                >
                  <option value="">Mes</option>
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
                  value={welcomeBirthYear}
                  onChange={(e) => setWelcomeBirthYear(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Año"
                >
                  <option value="">Año</option>
                  {welcomeBirthYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-900">Perfil de {childProfileName}</p>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="welcomeChildFirstName" className="text-xs font-medium text-gray-600">
                  Nombre
                </label>
                <input
                  id="welcomeChildFirstName"
                  type="text"
                  value={welcomeChildFirstName}
                  onChange={(e) => setWelcomeChildFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label htmlFor="welcomeChildLastName" className="text-xs font-medium text-gray-600">
                  Apellido(s)
                </label>
                <input
                  id="welcomeChildLastName"
                  type="text"
                  value={welcomeChildLastName}
                  onChange={(e) => setWelcomeChildLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-900">Fecha de nacimiento</label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={welcomeChildBirthDay}
                  onChange={(e) => {
                    setWelcomeChildBirthDay(e.target.value)
                    setWelcomeChildBirthError(false)
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Día"
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                    <option key={`child-${day}`} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <select
                  value={welcomeChildBirthMonth}
                  onChange={(e) => {
                    setWelcomeChildBirthMonth(e.target.value)
                    setWelcomeChildBirthError(false)
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Mes"
                >
                  <option value="">Mes</option>
                  {SPANISH_MONTHS.map((monthName, index) => {
                    const monthValue = String(index + 1).padStart(2, '0')
                    return (
                      <option key={`child-${monthValue}`} value={monthValue}>
                        {monthName}
                      </option>
                    )
                  })}
                </select>
                <select
                  value={welcomeChildBirthYear}
                  onChange={(e) => {
                    setWelcomeChildBirthYear(e.target.value)
                    setWelcomeChildBirthError(false)
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  aria-label="Año"
                >
                  <option value="">Año</option>
                  {welcomeBirthYears.map((year) => (
                    <option key={`child-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {welcomeChildBirthError ? (
                <p className="mt-1 text-xs text-red-500">La fecha de nacimiento es obligatoria</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">(importante para recordatorios)</p>
              )}
            </div>
          </div>
          {!showWelcomeSecondChild ? (
            <button
              type="button"
              onClick={() => setShowWelcomeSecondChild(true)}
              className="mt-3 text-sm text-gray-400 underline hover:text-gray-600"
            >
              + Añadir otro hijo/a
            </button>
          ) : null}
          {showWelcomeSecondChild ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Otro hijo/a</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="welcomeChild2FirstName" className="text-xs font-medium text-gray-600">
                    Nombre
                  </label>
                  <input
                    id="welcomeChild2FirstName"
                    type="text"
                    value={welcomeChild2FirstName}
                    onChange={(e) => setWelcomeChild2FirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label htmlFor="welcomeChild2LastName" className="text-xs font-medium text-gray-600">
                    Apellido(s)
                  </label>
                  <input
                    id="welcomeChild2LastName"
                    type="text"
                    value={welcomeChild2LastName}
                    onChange={(e) => setWelcomeChild2LastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900">Fecha de nacimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={welcomeChild2BirthDay}
                    onChange={(e) => setWelcomeChild2BirthDay(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    aria-label="Día"
                  >
                    <option value="">Día</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => (
                      <option key={`child2-${day}`} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <select
                    value={welcomeChild2BirthMonth}
                    onChange={(e) => setWelcomeChild2BirthMonth(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    aria-label="Mes"
                  >
                    <option value="">Mes</option>
                    {SPANISH_MONTHS.map((monthName, index) => {
                      const monthValue = String(index + 1).padStart(2, '0')
                      return (
                        <option key={`child2-${monthValue}`} value={monthValue}>
                          {monthName}
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={welcomeChild2BirthYear}
                    onChange={(e) => setWelcomeChild2BirthYear(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    aria-label="Año"
                  >
                    <option value="">Año</option>
                    {welcomeBirthYears.map((year) => (
                      <option key={`child2-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-400">(importante para recordatorios)</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveWelcomeProfile()}
            className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
          >
            Completar mi perfil
          </button>
          <button
            type="button"
            onClick={() => void handleSkipWelcomeProfile()}
            className="mt-3 w-full text-center text-sm text-gray-400 underline hover:text-gray-600"
          >
            Completaré mi perfil después
          </button>
        </div>
      </div>
    )
  }
  return (
    <main className={`relative min-h-screen bg-gradient-to-b ${pageBg}`}>
      <MetaPixelPageView />
      {rsvpTopNav}
      {renderWelcomeModal()}
      {renderPostConversionModal()}
      <div className="px-4 py-6 pb-10 sm:py-8">
      {saveToastVisible ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 sm:px-4"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className={`max-w-md w-full rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold tracking-tight text-white shadow-lg transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
              saveToastEntered ? 'translate-y-0 opacity-100' : '-translate-y-[140%] opacity-95'
            }`}
          >
            ✅ ¡Respuesta actualizada!
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 sm:gap-6">
        {/* CARD 1 — Event details */}
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-5">
            {eventData?.invitation_image_url ? (
              <div className="max-h-72 w-full overflow-hidden rounded-xl">
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

            {eventData ? (
              <>
                <h1 className="text-center text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  {eventData.title}
                </h1>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-800">{`📅 ${formatSpanishFullDate(eventData.event_date)}`}</p>
                  {confirmacionesLine ? (
                    <p className="text-gray-500">{confirmacionesLine}</p>
                  ) : null}
                  <p className="text-gray-800">
                    {eventData.pickup_time
                      ? `🕒 ${formatTimeValue(eventData.start_time)} a ${formatTimeValue(eventData.pickup_time)}`
                      : `🕒 ${formatTimeValue(eventData.start_time)}`}
                  </p>
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{`📍 ${eventData.location_name ?? 'Ubicación'}`}</p>
                    {eventData.location_address ? (
                      <p className="pl-0 text-gray-700 sm:pl-6">{eventData.location_address}</p>
                    ) : null}
                    {eventData.google_maps_url ? (
                      <a
                        href={eventData.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                      >
                        Ver en Google Maps ↗
                      </a>
                    ) : null}
                  </div>
                  {giftLine ? <p className="text-gray-800">{giftLine}</p> : null}
                  {hasFoodOptions && foodOptions.length > 0 ? (
                    <p className="text-gray-800">{`🍽️ ${foodOptions.map((option) => option.label).join(' · ')}`}</p>
                  ) : null}
                  {eventData.organizer_phone != null && eventData.organizer_phone.trim() !== '' ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                      <span className="text-sm font-medium text-gray-700">
                        <span aria-hidden>📞</span> Contacto
                      </span>
                      <a
                        href={`tel:${eventData.organizer_phone.trim()}`}
                        className={`text-sm font-medium ${organizerPhoneLinkClass(themeKey)}`}
                      >
                        {eventData.organizer_phone.trim()}
                      </a>
                      {digitsForWhatsApp(eventData.organizer_phone).length >= 8 ? (
                        <a
                          href={`https://wa.me/${digitsForWhatsApp(eventData.organizer_phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 text-green-500 transition hover:text-[#25D366]"
                          aria-label="WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {eventData.organizer_notes?.trim() ? (
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-800">
                      <span aria-hidden>📋</span> Notas del organizador
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                      {eventData.organizer_notes}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </article>

        {/* CARD 2 — Current response summary */}
        {baselinePayload ? (
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Tu respuesta actual</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${savedResponseBadgeClasses(baselinePayload.attendance_status)}`}
              >
                {statusSummaryLabels[baselinePayload.attendance_status]}
              </span>
              <p className="text-gray-800">
                <span className="text-gray-500">Niño/a:</span>{' '}
                <span className="font-medium text-gray-900">{baselinePayload.child_name || '—'}</span>
              </p>
              <p className="text-gray-800">
                <span className="text-gray-500">Padre/madre:</span>{' '}
                <span className="font-medium text-gray-900">{baselinePayload.guest_parent_name || '—'}</span>
              </p>
              {baselinePayload.food_preference ? (
                <p className="text-gray-800">
                  <span className="text-gray-500">Comida:</span>{' '}
                  <span className="font-medium text-gray-900">{baselinePayload.food_preference}</span>
                </p>
              ) : null}
              {baselinePayload.allergy_notes ? (
                <p className="text-gray-800">
                  <span className="text-gray-500">Alergias:</span>{' '}
                  <span className="text-gray-900">{baselinePayload.allergy_notes}</span>
                </p>
              ) : null}
              {baselinePayload.extra_notes ? (
                <p className="whitespace-pre-wrap text-gray-800">
                  <span className="text-gray-500">Mensaje:</span>{' '}
                  <span className="text-gray-900">{baselinePayload.extra_notes}</span>
                </p>
              ) : null}
            </div>
            {renderSignupBanner()}
            <p className="mt-6 text-center text-xs text-gray-500">¿Quieres cambiar tu respuesta?</p>
            <div className="relative z-20 mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleAttendancePickFromSummary('confirmed')}
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
                onClick={() => handleAttendancePickFromSummary('declined')}
                className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium transition ${
                  attendance === 'declined'
                    ? `${activeTheme.border} ${activeTheme.button} text-gray-900`
                    : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                }`}
              >
                ❌ No
              </button>
            </div>
          </article>
        ) : null}

        {/* CARD 3 — Details form (revealed after choosing attendance above) */}
        {detailsFormVisible && attendance ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Actualiza los detalles</h2>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Datos del invitado</p>
                <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="edit-childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre *
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
                    Apellido(s) *
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

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Respuesta enviada por</p>
                <div>
                <label htmlFor="edit-parentName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Nombre *
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
                      onChange={(e) => setParentPhoneNumber(sanitizePhoneInput(e.target.value))}
                      required
                      placeholder="Ej. 612345678"
                      className={`min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${inputFocusClass}`}
                    />
                  </div>
                </div>
              ) : null}
              </div>

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

              {!isLoggedIn ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <p className="flex-1 text-sm text-gray-600">
                    ¿Tú también organizas fiestas? Regístrate y gestiona todo desde un solo lugar.
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={signupToggle}
                    onClick={() => {
                      const next = !signupToggle
                      setSignupToggle(next)
                      if (next) trackLead('rsvp_signup_interest')
                      if (next) trackTikTokLead('rsvp_signup_interest')
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      signupToggle ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                        signupToggle ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ) : null}

              {!isLoggedIn && signupToggle ? (
                <div className="space-y-2">
                  {renderGoogleSignupButton(handleGoogleSignup)}
                  <p className="text-center text-xs text-gray-500">o</p>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                  <div className="relative">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Contraseña"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackLead('rsvp_crear_cuenta')
                      trackTikTokLead('rsvp_crear_cuenta')
                      void handleEmailSignup()
                    }}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-gray-900 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  loading ||
                  !attendance ||
                  !detailsFormVisible ||
                  !hasFormChanges ||
                  (signupToggle && !isLoggedIn)
                }
                className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                  loading ||
                  !attendance ||
                  !detailsFormVisible ||
                  !hasFormChanges ||
                  (signupToggle && !isLoggedIn)
                    ? 'border border-gray-200 bg-gray-200 text-gray-500'
                    : `${activeTheme.button} text-gray-900 ${activeTheme.buttonHover}`
                }`}
              >
                {loading
                  ? 'Guardando...'
                  : signupToggle && !isLoggedIn
                    ? 'Termina de registrarte para guardar'
                    : 'Guardar respuesta'}
              </button>
            </form>
          </section>
        ) : null}
      </div>

      {hasSavedOnce && token ? (
        <div className="mx-auto mt-6 w-full max-w-md px-1 pb-2 text-center sm:mt-8">
          <p className="text-xs leading-relaxed text-gray-500">¿Necesitas hacer otro cambio en el futuro?</p>
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white/60 px-3 py-3 sm:flex-row sm:justify-between sm:gap-3">
            <code className="max-w-full break-all text-left text-[11px] text-gray-500">{`miparty.net/rsvp/${token}`}</code>
            <button
              type="button"
              onClick={() => void copySavedEditLink()}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-800"
            >
              {savedEditCopyDone ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </main>
  )
}
