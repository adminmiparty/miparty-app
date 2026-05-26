'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import AppNav from '@/components/AppNav'
import EventCreationSteps from '@/components/EventCreationSteps'
import { brand } from '@/lib/brand'
import { sanitizePhoneInput, validatePhoneNumber } from '@/lib/phone'
import { trackLead, trackRsvpAttendanceLead, trackViewContent } from '@/lib/meta-pixel'
import {
  trackLead as trackTikTokLead,
  trackViewContent as trackTikTokViewContent,
} from '@/lib/tiktok-pixel'
import { eventFlowShellClass, eventFormBrandUi } from '@/lib/eventFormTheme'
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

function useInvitationPreviewExit(publicSlug: string, themeKey: string | null) {
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const t =
    themeKey === 'yellow' || themeKey === 'pink' || themeKey === 'blue' || themeKey === 'green' || themeKey === 'purple'
      ? themeKey
      : 'yellow'
  const shareHref = `/dashboard/eventos/${publicSlug}/compartir?theme=${encodeURIComponent(t)}`
  const dashboardHref = `/dashboard/eventos/${publicSlug}`
  const backHref = fromParam === 'dashboard' ? dashboardHref : shareHref
  const backLabel =
    fromParam === 'dashboard'
      ? '⬅️ Volver'
      : '⬅️ Volver y compartir invitación'
  return { backHref, backLabel }
}

export function InvitationPreviewTopBar({
  publicSlug,
  themeKey,
}: {
  publicSlug: string
  themeKey: string | null
}) {
  const { backHref, backLabel } = useInvitationPreviewExit(publicSlug, themeKey)

  return (
    <AppNav
      backHref={backHref}
      backLabel={backLabel}
      centerSlot={
        <EventCreationSteps
          variant="nav"
          step={2}
          progressAccentClass={eventFormBrandUi.progressAccent}
          progressTrackClass={eventFormBrandUi.progressTrack}
          progressCardBorderClass={eventFormBrandUi.progressCardBorder}
        />
      }
    />
  )
}

export function InvitationPreviewBottomBar({
  publicSlug,
  themeKey,
}: {
  publicSlug: string
  themeKey: string | null
}) {
  const { backHref } = useInvitationPreviewExit(publicSlug, themeKey)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm">
      <div className={`pointer-events-auto py-3 ${eventFlowShellClass}`}>
        <Link
          href={backHref}
          className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${brand.buttonPrimary}`}
        >
          Volver y terminar evento
        </Link>
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

const POST_RSVP_STORAGE_KEY = 'miparty_post_rsvp_v1'

type PostRsvpPersist = {
  rsvpId: string
  attendance: AttendanceStatus
  editToken: string | null
  parentName: string
  parentFirst: string
  parentLast: string
  parentPhone: string
  childFirst: string
  childLast: string
  childName?: string
  phone?: string
  foodPreference?: string
  allergyNotes?: string
  extraNotes?: string
}

function resolveProfileNameParts(
  trimmedParentName: string,
  googleFullName: string | null | undefined
): { firstName: string; lastName: string } {
  const source = trimmedParentName
    ? trimmedParentName.trim()
    : (googleFullName ?? '').trim()
  if (!source) {
    return { firstName: '', lastName: '' }
  }
  const lastSpace = source.lastIndexOf(' ')
  if (lastSpace === -1) {
    return { firstName: source, lastName: '' }
  }
  return {
    firstName: source.slice(0, lastSpace).trim(),
    lastName: source.slice(lastSpace + 1).trim(),
  }
}

async function linkRsvpAndProfile(
  sb: ReturnType<typeof createClient>,
  userId: string,
  rsvpId: string,
  profile: { parentName: string; parentPhone: string; childFirst: string; childLast: string },
  signupSource: string
) {
  await sb.from('rsvps').update({ user_id: userId }).eq('id', rsvpId)
  const { error: childErr } = await sb.from('children').insert({
    user_id: userId,
    name: profile.childFirst,
    last_name: profile.childLast || null,
    birth_date: null,
  })
  if (childErr && !childErr.message.includes('duplicate')) {
    console.warn('children insert:', childErr.message)
  }
  const {
    data: { user },
  } = await sb.auth.getUser()
  const googleFullName =
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
  const { firstName, lastName } = resolveProfileNameParts(profile.parentName.trim(), googleFullName)

  await sb.from('users').upsert({
    id: userId,
    first_name: firstName,
    last_name: lastName || null,
    phone: profile.parentPhone || null,
    signup_source: signupSource,
  })
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
  if (!day || !month || !year) {
    return null
  }
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

type ModalView = 'signup' | 'login' | 'success' | 'welcome' | 'welcome_success'

function splitDialPhone(full: string): {
  countryCode: '+34' | '+57' | 'otro'
  customCode: string
  number: string
} {
  const trimmed = full.trim()
  if (!trimmed) return { countryCode: '+34', customCode: '', number: '' }
  if (trimmed.startsWith('+57')) {
    return { countryCode: '+57', customCode: '', number: trimmed.slice(3) }
  }
  if (trimmed.startsWith('+34')) {
    return { countryCode: '+34', customCode: '', number: trimmed.slice(3) }
  }
  const match = trimmed.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1] && match[2] !== undefined) {
    return { countryCode: 'otro', customCode: match[1], number: match[2].replace(/\s/g, '') }
  }
  return { countryCode: 'otro', customCode: '', number: trimmed.replace(/^\+/, '') }
}

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function attendanceSelectionFeedback(
  status: AttendanceStatus,
  rsvpDeadline: string | null
): string {
  if (status === 'confirmed') {
    return '🎉 ¡Genial! Confirma los detalles abajo.'
  }
  if (status === 'declined') {
    return 'Gracias por avisar 🙌'
  }
  if (status === 'maybe') {
    if (rsvpDeadline) {
      return `Sin problema 👍 puedes decidir más tarde.\nEsperamos tu respuesta hasta el ${capitalizeFirst(rsvpDeadline)}.`
    }
    return 'Sin problema 👍 puedes decidir más tarde.'
  }
  return ''
}

const calendarProviderLogos = {
  google: { src: '/calendar/google.png', label: 'Google' },
  apple: { src: '/calendar/apple.png', label: 'Apple' },
  outlook: { src: '/calendar/outlook.png', label: 'Outlook' },
} as const

function CalendarProviderLogo({ src, label }: { src: string; label: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 shrink-0 object-contain"
      aria-hidden
    />
  )
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
  const [parentFirstName, setParentFirstName] = useState('')
  const [parentLastName, setParentLastName] = useState('')
  const parentFirstNameRef = useRef('')
  const parentLastNameRef = useRef('')
  const childFirstRef = useRef('')
  const childLastRef = useRef('')

  const syncChildNameFields = (first: string, last: string) => {
    setChildName(first)
    setChildLastName(last)
    childFirstRef.current = first
    childLastRef.current = last
  }

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
  const [submittedData, setSubmittedData] = useState<{
    childName: string
    parentName: string
    foodPreference: string | null
    allergyNotes: string | null
    extraNotes: string | null
    phone: string | null
  } | null>(null)
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

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null)
  const [signupToggle, setSignupToggle] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [modalView, setModalView] = useState<ModalView>('signup')
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
  const [welcomeParentBirthError, setWelcomeParentBirthError] = useState(false)
  const [welcomePhoneError, setWelcomePhoneError] = useState('')
  const [submittedRsvpId, setSubmittedRsvpId] = useState<string | null>(null)
  const submittedRsvpIdRef = useRef<string | null>(null)
  const [inlineSignupEmail, setInlineSignupEmail] = useState('')
  const [inlineSignupPassword, setInlineSignupPassword] = useState('')
  const [modalSignupEmail, setModalSignupEmail] = useState('')
  const [modalSignupPassword, setModalSignupPassword] = useState('')
  const [modalLoginEmail, setModalLoginEmail] = useState('')
  const [modalLoginPassword, setModalLoginPassword] = useState('')
  const [showModalForgotPassword, setShowModalForgotPassword] = useState(false)
  const [modalForgotEmail, setModalForgotEmail] = useState('')
  const [modalForgotSent, setModalForgotSent] = useState(false)
  const [modalForgotError, setModalForgotError] = useState('')
  const [showInlineForgotPassword, setShowInlineForgotPassword] = useState(false)
  const [inlineForgotEmail, setInlineForgotEmail] = useState('')
  const [inlineForgotSent, setInlineForgotSent] = useState(false)
  const [inlineForgotError, setInlineForgotError] = useState('')
  const [modalShowEmailFields, setModalShowEmailFields] = useState(false)
  const [signupFlowError, setSignupFlowError] = useState<string | null>(null)
  const [showInlineLogin, setShowInlineLogin] = useState(false)
  const [inlineEmail, setInlineEmail] = useState('')
  const [inlinePassword, setInlinePassword] = useState('')
  const [showModalSignupPassword, setShowModalSignupPassword] = useState(false)
  const [showModalLoginPassword, setShowModalLoginPassword] = useState(false)
  const [showInlineLoginPassword, setShowInlineLoginPassword] = useState(false)
  const [showInlineSignupPassword, setShowInlineSignupPassword] = useState(false)
  const [inlineLoginError, setInlineLoginError] = useState('')
  const [inlineLoginSuccess, setInlineLoginSuccess] = useState(false)
  const [justSignedUp, setJustSignedUp] = useState(false)
  const oauthLinkDoneRef = useRef(false)

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
    if (!attendance) return ''
    return attendanceSelectionFeedback(attendance, rsvpDeadline ?? null)
  }, [attendance, rsvpDeadline])

  const submittedFeedbackText = useMemo(() => {
    if (!submittedStatus) return ''
    return attendanceSelectionFeedback(submittedStatus, rsvpDeadline ?? null)
  }, [submittedStatus, rsvpDeadline])

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
    setParentName(`${parentFirstName} ${parentLastName}`.trim())
  }, [parentFirstName, parentLastName])

  useEffect(() => {
    submittedRsvpIdRef.current = submittedRsvpId
  }, [submittedRsvpId])

  useEffect(() => {
    oauthLinkDoneRef.current = false
  }, [])

  useEffect(() => {
    const sb = createClient()
    let subscription: { unsubscribe: () => void } | undefined

    const run = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      if (code) {
        await sb.auth.exchangeCodeForSession(code)
        searchParams.delete('code')
        const query = searchParams.toString()
        const cleanUrl =
          window.location.pathname + (query ? `?${query}` : '') + window.location.hash
        window.history.replaceState({}, '', cleanUrl)
      }

      void sb.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setIsLoggedIn(true)
          setLoggedInUserId(user.id)
        }
      })

      try {
        const stored = sessionStorage.getItem(POST_RSVP_STORAGE_KEY)
        const parsed = stored ? (JSON.parse(stored) as PostRsvpPersist) : null
        if (parsed?.rsvpId) {
          submittedRsvpIdRef.current = parsed.rsvpId
          setSubmittedRsvpId(parsed.rsvpId)
          if (parsed.attendance) {
            setSubmittedStatus(parsed.attendance)
            setSubmittedEditToken(parsed.editToken ?? null)
          }
        }
      } catch {
        // ignore
      }

      const {
        data: { subscription: sub },
      } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event)
      console.log('Session user:', session?.user?.email)
      console.log('OAuth pending flag:', sessionStorage.getItem('miparty_oauth_pending'))
      if (!session?.user) return
      const pending = sessionStorage.getItem('miparty_oauth_pending')
      if (!pending) return
      console.log('oauthLinkDoneRef:', oauthLinkDoneRef.current)
      console.log('submittedRsvpId:', submittedRsvpId)
      console.log('submittedRsvpIdRef:', submittedRsvpIdRef?.current)
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return
      if (oauthLinkDoneRef.current) return

      let parsed: PostRsvpPersist | null = null
      try {
        const stored = sessionStorage.getItem(POST_RSVP_STORAGE_KEY)
        parsed = stored ? (JSON.parse(stored) as PostRsvpPersist) : null
      } catch {
        return
      }
      console.log('Stored RSVP data:', parsed)

      oauthLinkDoneRef.current = true

      if (parsed) {
        if (parsed.parentFirst || parsed.parentLast) {
          const first = parsed.parentFirst ?? ''
          const last = parsed.parentLast ?? ''
          setParentFirstName(first)
          setParentLastName(last)
          parentFirstNameRef.current = first
          parentLastNameRef.current = last
        } else if (parsed.parentName?.trim()) {
          const { firstName, lastName } = resolveProfileNameParts(parsed.parentName.trim(), null)
          setParentFirstName(firstName)
          setParentLastName(lastName)
          parentFirstNameRef.current = firstName
          parentLastNameRef.current = lastName
        }
        if (parsed.childFirst || parsed.childLast) {
          syncChildNameFields(parsed.childFirst ?? '', parsed.childLast ?? '')
        } else if (parsed.childName?.trim()) {
          const childParts = parsed.childName.trim().split(/\s+/).filter(Boolean)
          syncChildNameFields(childParts[0] ?? '', childParts.slice(1).join(' ') || '')
        }
        const phoneValue = parsed.phone ?? parsed.parentPhone
        if (phoneValue) {
          const phoneParts = splitDialPhone(phoneValue)
          setParentCountryCode(phoneParts.countryCode)
          setParentCustomCode(phoneParts.customCode)
          setParentPhoneNumber(phoneParts.number)
        }
        if (parsed.attendance) setAttendance(parsed.attendance)
        if (parsed.foodPreference) setFoodPreference(parsed.foodPreference)
        if (parsed.allergyNotes) setAllergyNotes(parsed.allergyNotes)
        if (parsed.extraNotes) setExtraNotes(parsed.extraNotes)
      }

      if (parsed?.rsvpId) {
        setSubmittedRsvpId(parsed.rsvpId)
        submittedRsvpIdRef.current = parsed.rsvpId
        console.log('About to call linkRsvpAndProfile, rsvpId:', parsed.rsvpId)
        const oauthSignupSource = sessionStorage.getItem('miparty_signup_source') ?? 'rsvp_modal'
        await linkRsvpAndProfile(
          sb,
          session.user.id,
          parsed.rsvpId,
          {
            parentName: parsed.parentName,
            parentPhone: parsed.parentPhone,
            childFirst: parsed.childFirst,
            childLast: parsed.childLast,
          },
          oauthSignupSource
        )
        console.log('linkRsvpAndProfile completed')
      } else {
        const oauthSignupSource = sessionStorage.getItem('miparty_signup_source')
        if (oauthSignupSource) {
          await sb.from('users').upsert({
            id: session.user.id,
            signup_source: oauthSignupSource,
          })
        }
      }

      const storedParentName = parsed?.parentName || ''
      const storedChildName = parsed?.childName || ''
      const storedPhone = parsed?.phone || ''

      const isNewUser = session.user.created_at
        ? Date.now() - new Date(session.user.created_at).getTime() < 60000
        : false

      if (isNewUser) {
        try {
          console.log('Calling prefillWelcomeForm...')
          await prefillWelcomeForm(
            session.user,
            storedParentName,
            storedChildName,
            storedPhone,
            parsed?.rsvpId || undefined,
            parsed?.parentFirst || undefined,
            parsed?.parentLast || undefined,
            parsed?.childFirst || '',
            parsed?.childLast || ''
          )
          console.log('prefillWelcomeForm completed')
          setModalView('welcome')
          console.log('modalView set to welcome')
          setShowSignupModal(true)
          console.log('showSignupModal set to true')
        } catch (err) {
          console.error('Error in welcome flow:', err)
        }
        setJustSignedUp(true)
      } else {
        const { data: profile } = await sb
          .from('users')
          .select('first_name, last_name, phone')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profile) {
          if (profile.first_name || profile.last_name) {
            setParentFirstName(profile.first_name ?? '')
            setParentLastName(profile.last_name ?? '')
          }
          if (profile.phone) {
            const phoneParts = splitDialPhone(String(profile.phone))
            setParentCountryCode(phoneParts.countryCode)
            setParentCustomCode(phoneParts.customCode)
            setParentPhoneNumber(phoneParts.number)
          }
        }
      }

      setIsLoggedIn(true)
      setLoggedInUserId(session.user.id)
      setSignupToggle(false)
      sessionStorage.removeItem('miparty_oauth_pending')
      sessionStorage.removeItem('miparty_signup_source')
      sessionStorage.removeItem(POST_RSVP_STORAGE_KEY)
      })

      subscription = sub
    }

    void run()

    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (modalView === 'success' && showSignupModal) {
      const timer = setTimeout(() => {
        setShowSignupModal(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [modalView, showSignupModal])

  useEffect(() => {
    if (modalView === 'welcome_success' && showSignupModal) {
      const timer = setTimeout(() => {
        setShowSignupModal(false)
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [modalView, showSignupModal])

  useEffect(() => {
    return () => {
      if (copyEditLinkTimeoutRef.current != null) {
        clearTimeout(copyEditLinkTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isPreview) {
      trackViewContent()
      trackTikTokViewContent()
    }
  }, [isPreview])

  useEffect(() => {
    if (!showSignupModal || isPreview || modalView !== 'signup') return
    trackLead('rsvp_conversion_modal_shown')
    trackTikTokLead('rsvp_conversion_modal_shown')
  }, [showSignupModal, modalView, isPreview])

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

  const persistCurrentFormToSession = () => {
    const parentFirstEl = document.getElementById('parentFirstName') as HTMLInputElement | null
    const parentLastEl = document.getElementById('parentLastName') as HTMLInputElement | null
    const childFirstEl = document.getElementById('childName') as HTMLInputElement | null
    const childLastEl = document.getElementById('childLastName') as HTMLInputElement | null

    const trimmedParentFirst = (
      parentFirstEl?.value ??
      parentFirstNameRef.current ??
      parentFirstName
    ).trim()
    const trimmedParentLast = (
      parentLastEl?.value ??
      parentLastNameRef.current ??
      parentLastName
    ).trim()
    const trimmedChildFirst = (childFirstEl?.value ?? childFirstRef.current ?? childName).trim()
    const trimmedChildLast = (childLastEl?.value ?? childLastRef.current ?? childLastName).trim()

    parentFirstNameRef.current = trimmedParentFirst
    parentLastNameRef.current = trimmedParentLast
    childFirstRef.current = trimmedChildFirst
    childLastRef.current = trimmedChildLast

    const trimmedParentName = `${trimmedParentFirst} ${trimmedParentLast}`.trim()
    const combinedChildName =
      trimmedChildLast.length > 0
        ? `${trimmedChildFirst} ${trimmedChildLast}`.trim()
        : trimmedChildFirst
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    const finalPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''

    let existing: Partial<PostRsvpPersist> = {}
    try {
      const raw = sessionStorage.getItem(POST_RSVP_STORAGE_KEY)
      if (raw) existing = JSON.parse(raw) as PostRsvpPersist
    } catch {
      // ignore
    }

    const rsvpId = existing.rsvpId ?? submittedRsvpIdRef.current ?? submittedRsvpId ?? ''
    const persistPayload: PostRsvpPersist = {
      rsvpId,
      attendance: attendance ?? existing.attendance ?? 'confirmed',
      editToken: existing.editToken ?? submittedEditToken,
      parentName: trimmedParentName,
      parentFirst: trimmedParentFirst,
      parentLast: trimmedParentLast,
      parentPhone: finalPhone || existing.parentPhone || '',
      childFirst: trimmedChildFirst,
      childLast: trimmedChildLast,
      childName: combinedChildName,
      phone: finalPhone,
      foodPreference,
      allergyNotes,
      extraNotes,
    }
    sessionStorage.setItem(POST_RSVP_STORAGE_KEY, JSON.stringify(persistPayload))
  }

  const handleGoogleSignup = async () => {
    persistCurrentFormToSession()
    const sb = createClient()
    sessionStorage.setItem('miparty_oauth_pending', '1')
    sessionStorage.setItem('miparty_signup_source', signupToggle ? 'rsvp_toggle' : 'rsvp_modal')
    oauthLinkDoneRef.current = false
    console.log('Starting Google OAuth, saving to sessionStorage')
    console.log('Stored data:', sessionStorage.getItem('miparty_post_rsvp_v1'))
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })
  }

  const renderGoogleSignupButton = (disabled?: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handleGoogleSignup()}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

  const handleEmailSignupInline = async () => {
    setSignupFlowError(null)
    const sb = createClient()
    const email = inlineSignupEmail.trim()
    const password = inlineSignupPassword
    if (!email || !password) {
      setSignupFlowError('Introduce email y contraseña.')
      return
    }
    const { data, error: signErr } = await sb.auth.signUp({
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
    if (uid) {
      const trimmedFirst = parentFirstNameRef.current.trim()
      const trimmedLast = parentLastNameRef.current.trim()
      await sb.from('users').upsert({
        id: uid,
        first_name: trimmedFirst || null,
        last_name: trimmedLast || null,
        signup_source: 'rsvp_toggle',
      })
      setJustSignedUp(true)
      const childFirstEl = document.getElementById('childName') as HTMLInputElement | null
      const childLastEl = document.getElementById('childLastName') as HTMLInputElement | null
      const childFirstValue = (childFirstEl?.value ?? childFirstRef.current).trim()
      const childLastValue = (childLastEl?.value ?? childLastRef.current).trim()
      childFirstRef.current = childFirstValue
      childLastRef.current = childLastValue
      await prefillWelcomeForm(
        undefined,
        undefined,
        undefined,
        '',
        undefined,
        parentFirstNameRef.current,
        parentLastNameRef.current,
        childFirstValue,
        childLastValue
      )
      setModalView('welcome')
      setShowSignupModal(true)
      setIsLoggedIn(true)
      setLoggedInUserId(uid)
    } else {
      setSignupFlowError('No se pudo completar el registro. Inténtalo de nuevo.')
    }
  }

  const handleEmailSignupModal = async () => {
    setSignupFlowError(null)
    if (!submittedRsvpId) {
      setSignupFlowError('No se encontró la confirmación. Recarga la página.')
      return
    }
    const sb = createClient()
    const email = modalSignupEmail.trim()
    const password = modalSignupPassword
    if (!email || !password) {
      setSignupFlowError('Introduce email y contraseña.')
      return
    }
    const trimmedParentName = parentName.trim()
    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    const trimmedParentPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''

    const { data, error: signErr } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: trimmedParentName,
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
    await linkRsvpAndProfile(
      sb,
      uid,
      submittedRsvpId,
      {
        parentName: trimmedParentName,
        parentPhone: trimmedParentPhone,
        childFirst: trimmedChildName,
        childLast: trimmedChildLastName,
      },
      'rsvp_modal'
    )
    setIsLoggedIn(true)
    setLoggedInUserId(uid)
    setJustSignedUp(true)
    await prefillWelcomeForm(
      undefined,
      trimmedParentName,
      undefined,
      trimmedParentPhone,
      submittedRsvpId,
      parentFirstName,
      parentLastName,
      trimmedChildName,
      trimmedChildLastName
    )
    setModalView('welcome')
  }

  const handleModalForgotPassword = async () => {
    setModalForgotError('')
    if (!modalForgotEmail.trim()) {
      setModalForgotError('Introduce tu email')
      return
    }
    const sb = createClient()
    const { error: resetError } = await sb.auth.resetPasswordForEmail(modalForgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (resetError) {
      setModalForgotError('No se pudo enviar el enlace. Inténtalo de nuevo.')
      return
    }
    setModalForgotSent(true)
  }

  const handleInlineForgotPassword = async () => {
    setInlineForgotError('')
    if (!inlineForgotEmail.trim()) {
      setInlineForgotError('Introduce tu email')
      return
    }
    const sb = createClient()
    const { error: resetError } = await sb.auth.resetPasswordForEmail(inlineForgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (resetError) {
      setInlineForgotError('No se pudo enviar el enlace. Inténtalo de nuevo.')
      return
    }
    setInlineForgotSent(true)
  }

  const handleLoginAndLink = async () => {
    setSignupFlowError(null)
    if (!submittedRsvpId) {
      setSignupFlowError('No se encontró la confirmación. Recarga la página.')
      return
    }
    const sb = createClient()
    const email = modalLoginEmail.trim()
    const password = modalLoginPassword
    if (!email || !password) {
      setSignupFlowError('Introduce email y contraseña.')
      return
    }
    const { data, error: signErr } = await sb.auth.signInWithPassword({ email, password })
    if (signErr) {
      setSignupFlowError(signErr.message)
      return
    }
    if (!data.user) {
      setSignupFlowError('No se pudo iniciar sesión.')
      return
    }
    await sb.from('rsvps').update({ user_id: data.user.id }).eq('id', submittedRsvpId)
    setIsLoggedIn(true)
    setLoggedInUserId(data.user.id)
    setJustSignedUp(true)
    const trimmedParentName = parentName.trim()
    const trimmedParentPhoneNumber = parentPhoneNumber.trim()
    const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
    const trimmedParentPhone =
      trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''
    await prefillWelcomeForm(
      undefined,
      trimmedParentName,
      undefined,
      trimmedParentPhone,
      submittedRsvpId
    )
    setModalView('welcome')
  }

  const prefillWelcomeForm = async (
    authUser?: User | null,
    nameSource?: string,
    childNameSource?: string,
    phoneSource?: string,
    rsvpId?: string | null,
    firstName?: string,
    lastName?: string,
    childFirst?: string,
    childLast?: string
  ) => {
    console.log('prefillWelcomeForm started with:', {
      nameSource,
      childNameSource,
      phoneSource,
      firstName,
      lastName,
      childFirst,
      childLast,
    })
    try {
      let user = authUser ?? null
      if (!user) {
        const {
          data: { user: fetchedUser },
        } = await supabase.auth.getUser()
        user = fetchedUser
        console.log('Got user:', user?.email)
      }
      if (firstName !== undefined) {
        setWelcomeFirstName(firstName.trim())
        setWelcomeLastName((lastName ?? '').trim())
      } else {
        const trimmedParentName = (nameSource ?? parentName).trim()
        const googleFullName =
          typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
        const { firstName: resolvedFirst, lastName: resolvedLast } = resolveProfileNameParts(
          trimmedParentName,
          googleFullName
        )
        setWelcomeFirstName(resolvedFirst)
        setWelcomeLastName(resolvedLast)
      }
      console.log('Name set, fetching child...')

      const hasExplicitChildName = childFirst !== undefined
      if (hasExplicitChildName) {
        setWelcomeChildFirstName(childFirst.trim())
        setWelcomeChildLastName((childLast ?? '').trim())
      } else {
        let combinedChildName = childNameSource?.trim() ?? ''
        if (!combinedChildName) {
          const trimmedChildName = childName.trim()
          const trimmedChildLastName = childLastName.trim()
          combinedChildName =
            trimmedChildLastName.length > 0
              ? `${trimmedChildName} ${trimmedChildLastName}`
              : trimmedChildName
        }
        const childParts = combinedChildName.split(/\s+/).filter(Boolean)
        setWelcomeChildFirstName(childParts[0] ?? '')
        setWelcomeChildLastName(childParts.slice(1).join(' '))
      }
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

      let fullPhone = phoneSource?.trim() ?? ''
      if (!fullPhone) {
        const trimmedParentPhoneNumber = parentPhoneNumber.trim()
        const finalParentDial = resolveDialCode(parentCountryCode, parentCustomCode)
        fullPhone =
          trimmedParentPhoneNumber.length > 0 ? `${finalParentDial}${trimmedParentPhoneNumber}` : ''
      }
      if (fullPhone) {
        const phoneParts = splitDialPhone(fullPhone)
        setWelcomePhoneCode(phoneParts.countryCode)
        setWelcomeCustomDialCode(phoneParts.customCode)
        setWelcomePhone(phoneParts.number)
      } else {
        setWelcomePhoneCode('+34')
        setWelcomeCustomDialCode('')
        setWelcomePhone('')
      }
      setWelcomeBirthDay('')
      setWelcomeBirthMonth('')
      setWelcomeBirthYear('')
      console.log('All welcome fields set')

      const rsvpIdForPrefill = rsvpId
      let recentChild: {
        name?: string | null
        last_name?: string | null
        birth_date?: string | null
      } | null = null
      if (user?.id && rsvpIdForPrefill) {
        try {
          const childFetch = supabase
            .from('children')
            .select('id, name, last_name, birth_date')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          )

          const result = await Promise.race([childFetch, timeoutPromise])
          recentChild = (result as { data?: unknown })?.data || null
        } catch (err) {
          console.log('Child fetch skipped:', err)
          recentChild = null
        }
      }

      if (recentChild && !hasExplicitChildName) {
        setWelcomeChildFirstName(recentChild.name ?? '')
        setWelcomeChildLastName(recentChild.last_name || '')
        if (recentChild.birth_date) {
          const [year, month, day] = String(recentChild.birth_date).split('T')[0].split('-')
          setWelcomeChildBirthYear(year ?? '')
          setWelcomeChildBirthMonth(month ?? '')
          setWelcomeChildBirthDay(day ?? '')
        }
      }
      console.log('prefillWelcomeForm finished')
    } catch (err) {
      console.error('prefillWelcomeForm error:', err)
    }
  }

  const validateWelcomeChildBirthDate = () => {
    const hasCompleteChildBirthDate =
      Boolean(welcomeChildBirthDay) &&
      Boolean(welcomeChildBirthMonth) &&
      Boolean(welcomeChildBirthYear)
    if (!hasCompleteChildBirthDate) {
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

    const fullWelcomePhone = `${welcomePhoneCode}${welcomePhone}`.trim()
    if (!welcomePhone.trim()) {
      setWelcomePhoneError('El teléfono es obligatorio')
      return
    }

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
    })

    const childBirthDate =
      welcomeChildBirthDay && welcomeChildBirthMonth && welcomeChildBirthYear
        ? `${welcomeChildBirthYear}-${String(welcomeChildBirthMonth).padStart(2, '0')}-${String(welcomeChildBirthDay).padStart(2, '0')}`
        : null

    console.log('Child birth date parts:', {
      day: welcomeChildBirthDay,
      month: welcomeChildBirthMonth,
      year: welcomeChildBirthYear,
      combined: childBirthDate,
    })

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
            birth_date: childBirthDate || null,
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
    const hasCompleteParentBirthDate =
      Boolean(welcomeBirthDay) && Boolean(welcomeBirthMonth) && Boolean(welcomeBirthYear)
    if (!hasCompleteParentBirthDate) {
      setWelcomeParentBirthError(true)
      return
    }
    setWelcomeParentBirthError(false)
    const fullWelcomePhone = `${welcomePhoneCode}${welcomePhone}`.trim()
    if (!welcomePhone.trim()) {
      setWelcomePhoneError('El teléfono es obligatorio')
      return
    }

    const welcomePhoneValidation = validatePhoneNumber(welcomePhone, welcomePhoneCode)
    if (!welcomePhoneValidation.valid && welcomePhoneValidation.error !== null) {
      setWelcomePhoneError(welcomePhoneValidation.error)
      return
    }

    await persistWelcomeProfile()
    setModalView('welcome_success')
  }

  const handleSkipWelcomeProfile = async () => {
    if (!validateWelcomeChildBirthDate()) return
    const fullWelcomePhone = `${welcomePhoneCode}${welcomePhone}`.trim()
    if (!welcomePhone.trim()) {
      setWelcomePhoneError('El teléfono es obligatorio')
      return
    }
    await persistWelcomeProfile()
    setModalView('welcome_success')
  }

  const handleInlineLogin = async () => {
    setInlineLoginError('')
    const trimmedEmail = inlineEmail.trim()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: inlinePassword,
    })
    if (signInError) {
      setInlineLoginError('Email o contraseña incorrectos')
      return
    }
    if (!data.user) {
      setInlineLoginError('Email o contraseña incorrectos')
      return
    }

    setIsLoggedIn(true)
    setLoggedInUserId(data.user.id)
    setShowInlineLogin(false)

    const { data: profile } = await supabase
      .from('users')
      .select('first_name, last_name, phone')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile) {
      if (profile.first_name || profile.last_name) {
        setParentFirstName(profile.first_name ?? '')
        setParentLastName(profile.last_name ?? '')
      }
      if (profile.phone) {
        const phoneParts = splitDialPhone(String(profile.phone))
        setParentCountryCode(phoneParts.countryCode)
        setParentCustomCode(phoneParts.customCode)
        setParentPhoneNumber(phoneParts.number)
      }
    }

    const authEmail = data.user.email?.trim()
    if (authEmail) setParentEmail(authEmail)

    setInlineLoginSuccess(true)
    window.setTimeout(() => setInlineLoginSuccess(false), 4000)
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
    if (attendance === 'confirmed' && hasFoodOptions && foodOptions.length > 0 && !trimmedFoodPreference) {
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
        user_id: loggedInUserId || null,
      })
      .eq('id', duplicatePrompt.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSubmittedEditToken(duplicatePrompt.edit_token ?? null)
    setSubmittedStatus(attendance)
    trackRsvpAttendanceLead(attendance)
    setSubmittedData({
      childName: combinedChildName,
      parentName: trimmedParentName,
      foodPreference: trimmedFoodPreference || null,
      allergyNotes: trimmedAllergyNotes || null,
      extraNotes: trimmedExtraNotes || null,
      phone: trimmedParentPhone || null,
    })
    const rid = duplicatePrompt.id
    setSubmittedRsvpId(rid)
    submittedRsvpIdRef.current = rid
    try {
      const persistPayload: PostRsvpPersist = {
        rsvpId: rid,
        attendance,
        editToken: duplicatePrompt.edit_token ?? null,
        parentName: trimmedParentName,
        parentFirst: parentFirstName.trim(),
        parentLast: parentLastName.trim(),
        parentPhone: trimmedParentPhone,
        childFirst: trimmedChildName,
        childLast: trimmedChildLastName,
      }
      sessionStorage.setItem(POST_RSVP_STORAGE_KEY, JSON.stringify(persistPayload))
    } catch {
      // ignore
    }
    oauthLinkDoneRef.current = false
    if (!isLoggedIn && !signupToggle) {
      setModalView('signup')
      setModalShowEmailFields(false)
      setSignupFlowError(null)
      setShowSignupModal(true)
    }
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

    const phoneValidation = validatePhoneNumber(parentPhoneNumber, parentCountryCode)
    if (!phoneValidation.valid && phoneValidation.error !== null) {
      setError(phoneValidation.error)
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

    if (attendance === 'confirmed' && hasFoodOptions && foodOptions.length > 0 && !trimmedFoodPreference) {
      setError('Selecciona una opción de comida.')
      return
    }

    const combinedChildName =
      trimmedChildLastName.length > 0 ? `${trimmedChildName} ${trimmedChildLastName}` : trimmedChildName

    setLoading(true)

    const rsvpPayload = {
      guest_parent_name: trimmedParentName,
      guest_parent_email: trimmedParentEmail || null,
      guest_parent_phone: trimmedParentPhone || null,
      child_name: combinedChildName,
      attendance_status: attendance,
      food_preference: attendance === 'confirmed' && hasFoodOptions ? trimmedFoodPreference || null : null,
      allergy_notes: attendance === 'confirmed' && hasFoodOptions ? trimmedAllergyNotes || null : null,
      extra_notes: trimmedExtraNotes || null,
      user_id: loggedInUserId || null,
    }

    if (submittedRsvpId) {
      const { error: updateError } = await supabase
        .from('rsvps')
        .update(rsvpPayload)
        .eq('id', submittedRsvpId)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setSubmittedData({
        childName: combinedChildName,
        parentName: trimmedParentName,
        foodPreference: trimmedFoodPreference || null,
        allergyNotes: trimmedAllergyNotes || null,
        extraNotes: trimmedExtraNotes || null,
        phone: trimmedParentPhone || null,
      })
      setSubmittedStatus(attendance)
      trackRsvpAttendanceLead(attendance)
      if (!isLoggedIn && !signupToggle && !isPreview) {
        setShowSignupModal(true)
        setModalView('signup')
      }
      setLoading(false)
      return
    }

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
        ...rsvpPayload,
      })
      .select('id, edit_token')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    const rowId = inserted?.id as string | undefined
    const token = inserted?.edit_token ?? null
    setSubmittedEditToken(token)
    setSubmittedStatus(attendance)
    trackRsvpAttendanceLead(attendance)
    setSubmittedData({
      childName: combinedChildName,
      parentName: trimmedParentName,
      foodPreference: trimmedFoodPreference || null,
      allergyNotes: trimmedAllergyNotes || null,
      extraNotes: trimmedExtraNotes || null,
      phone: trimmedParentPhone || null,
    })
    if (rowId) {
      setSubmittedRsvpId(rowId)
      submittedRsvpIdRef.current = rowId
      try {
        const persistPayload: PostRsvpPersist = {
          rsvpId: rowId,
          attendance,
          editToken: token,
          parentName: trimmedParentName,
          parentFirst: parentFirstName.trim(),
          parentLast: parentLastName.trim(),
          parentPhone: trimmedParentPhone,
          childFirst: trimmedChildName,
          childLast: trimmedChildLastName,
        }
        sessionStorage.setItem(POST_RSVP_STORAGE_KEY, JSON.stringify(persistPayload))
      } catch {
        // ignore
      }
    }

    oauthLinkDoneRef.current = false

    if (!isLoggedIn && !signupToggle) {
      setModalView('signup')
      setModalShowEmailFields(false)
      setSignupFlowError(null)
      setShowSignupModal(true)
    }

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

  const renderJustSignedUpProfileCta = () =>
    justSignedUp ? (
      <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
        <p className="mb-2 text-center text-xs text-gray-500">🎉 Tu cuenta MiParty ha sido creada</p>
        <a
          href="/dashboard"
          className="block w-full rounded-lg bg-yellow-400 px-4 py-2.5 text-center text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
        >
          Explorar mi perfil →
        </a>
      </div>
    ) : null

  const renderResponseSummary = () => {
    if (!submittedData || !submittedStatus) return null
    const statusLabel = {
      confirmed: '✅ Confirmado',
      declined: '❌ No puede asistir',
      maybe: '🤔 Aún no lo sabe',
    }
    return (
      <>
        <div className="mt-4 space-y-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Tu respuesta</p>
          <p className="text-sm font-medium text-gray-800">{statusLabel[submittedStatus]}</p>
          <p className="text-sm text-gray-700">👶 {submittedData.childName}</p>
          <p className="text-sm text-gray-700">👤 {submittedData.parentName}</p>
          {submittedData.foodPreference ? (
            <p className="text-sm text-gray-700">🍽️ {submittedData.foodPreference}</p>
          ) : null}
          {submittedData.allergyNotes ? (
            <p className="text-sm text-red-600">⚠️ {submittedData.allergyNotes}</p>
          ) : null}
          {submittedData.extraNotes ? (
            <p className="text-sm italic text-gray-500">💬 {submittedData.extraNotes}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setSubmittedStatus(null)}
          className="mt-3 w-full text-sm text-gray-500 underline hover:text-gray-700"
        >
          ¿Algo está mal? Cambiar respuesta
        </button>
      </>
    )
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

  const welcomeBirthYears = Array.from({ length: 101 }, (_, index) =>
    String(new Date().getFullYear() - index)
  )

  const renderWelcomeView = () => {
    const displayFirstName =
      welcomeFirstName.trim() ||
      parentName.trim().split(/\s+/).filter(Boolean)[0] ||
      'ahí'

    const trimmedChildName = childName.trim()
    const trimmedChildLastName = childLastName.trim()
    const combinedChildName =
      trimmedChildLastName.length > 0
        ? `${trimmedChildName} ${trimmedChildLastName}`
        : trimmedChildName ||
          [welcomeChildFirstName.trim(), welcomeChildLastName.trim()].filter(Boolean).join(' ')

    return (
      <div className="pt-2">
        <p className="text-center text-4xl" aria-hidden>
          🎉
        </p>
        <h3 className="mt-2 text-center text-xl font-bold text-gray-900">
          ¡Bienvenido/a a MiParty, {displayFirstName}!
        </h3>
        <p className="mt-2 text-center text-sm text-gray-500">
          Con MiParty puedes organizar cumpleaños, gestionar confirmaciones y llevar el control de alergias
          y comidas en un solo lugar.
        </p>

        <p className="mt-4 text-sm font-semibold text-gray-900">Completa tu perfil</p>

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
              Teléfono *
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={welcomePhoneCode}
                onChange={(e) => {
                  setWelcomePhoneCode(e.target.value)
                  setWelcomePhoneError('')
                }}
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
                  onChange={(e) => {
                    setWelcomeCustomDialCode(sanitizeDialPrefix(e.target.value))
                    setWelcomePhoneError('')
                  }}
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
                onChange={(e) => {
                  setWelcomePhone(sanitizePhoneInput(e.target.value))
                  setWelcomePhoneError('')
                }}
                placeholder="Ej. 612345678"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>
            {welcomePhoneError && (
              <p className="mt-1 text-xs text-red-500">{welcomePhoneError}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">Tu fecha de nacimiento</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={welcomeBirthDay}
                onChange={(e) => {
                  setWelcomeBirthDay(e.target.value)
                  setWelcomeParentBirthError(false)
                }}
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
                onChange={(e) => {
                  setWelcomeBirthMonth(e.target.value)
                  setWelcomeParentBirthError(false)
                }}
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
                onChange={(e) => {
                  setWelcomeBirthYear(e.target.value)
                  setWelcomeParentBirthError(false)
                }}
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
            {welcomeParentBirthError ? (
              <p className="mt-1 text-xs text-red-500">Tu fecha de nacimiento es obligatoria</p>
            ) : null}
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-900">Perfil de {combinedChildName}</p>

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
              <p className="mt-1 text-xs text-red-500">La fecha de nacimiento del niño/a es obligatoria</p>
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
          Completar mi perfil y confirmar asistencia
        </button>
        <button
          type="button"
          onClick={() => void handleSkipWelcomeProfile()}
          className="mt-3 w-full text-center text-sm text-gray-400 underline hover:text-gray-600"
        >
          Completaré mi perfil después y confirmar mi asistencia
        </button>
      </div>
    )
  }

  const renderWelcomeSuccessView = () => {
    const displayFirstName =
      welcomeFirstName.trim() ||
      parentName.trim().split(/\s+/).filter(Boolean)[0] ||
      'ahí'

    return (
      <div className="pt-2">
        <p className="text-center text-4xl" aria-hidden>
          🎉
        </p>
        <h3 className="mt-2 text-center text-xl font-bold text-gray-900">
          ¡Bienvenido/a a MiParty, {displayFirstName}!
        </h3>
        <p className="mt-2 text-center text-sm text-gray-500">
          Tu cuenta ha sido creada y tu respuesta guardada. Ahora puedes organizar tus propios cumpleaños,
          gestionar confirmaciones y llevar el control de todo desde un solo lugar.
        </p>
        <button
          type="button"
          onClick={() => setShowSignupModal(false)}
          className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
        >
          Volver a mi confirmación 🎉
        </button>
      </div>
    )
  }

  function renderPostSignupModal() {
    if (!showSignupModal || isPreview) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
        <div className="relative mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            type="button"
            className="absolute right-3 top-2 text-2xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="Cerrar"
            onClick={() => setShowSignupModal(false)}
          >
            ×
          </button>

          {modalView === 'signup' ? (
            <div className="pt-2">
              <p className="text-center text-2xl" aria-hidden>
                🎉
              </p>
              <h3 className="mt-2 text-center text-lg font-bold text-gray-900">
                ¡Estás a punto de enviar tu respuesta para el {eventTitle}!
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
              <div className="mt-4">{renderGoogleSignupButton()}</div>
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
                    setModalView('login')
                    setSignupFlowError(null)
                  }}
                  className="text-sm text-gray-500 underline hover:text-gray-700"
                >
                  Ya tengo cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignupModal(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  No gracias, continuar
                </button>
              </div>
            </div>
          ) : null}

          {modalView === 'login' ? (
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
                  {renderGoogleSignupButton()}
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
                    onClick={() => void handleLoginAndLink()}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Iniciar sesión
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setModalView('signup')
                  setSignupFlowError(null)
                }}
                className="mt-3 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </button>
            </div>
          ) : null}

          {modalView === 'welcome' ? renderWelcomeView() : null}

          {modalView === 'welcome_success' ? renderWelcomeSuccessView() : null}

          {modalView === 'success' ? (
            <div className="pt-2 text-center">
              <p className="text-4xl" aria-hidden>
                🎊
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-900">¡Bienvenido/a!</h3>
              <p className="mt-2 text-sm text-gray-600">
                Tu cuenta ha sido creada y tu confirmación ha sido vinculada.
              </p>
            </div>
          ) : null}

          {signupFlowError &&
          modalView !== 'success' &&
          modalView !== 'welcome' &&
          modalView !== 'welcome_success' ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-center text-xs text-red-700">
              {signupFlowError}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (submittedStatus === 'confirmed') {
    return (
      <>
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
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleGoogleCalendar}
              aria-label="Añadir a Google Calendar"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-2 transition hover:bg-gray-50"
            >
              <CalendarProviderLogo {...calendarProviderLogos.google} />
              <span className="truncate text-[11px] font-medium text-gray-800">
                {calendarProviderLogos.google.label}
              </span>
            </button>
            <button
              type="button"
              onClick={() => downloadIcsFile('evento-apple.ics')}
              aria-label="Añadir a Apple Calendar"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-2 transition hover:bg-gray-50"
            >
              <CalendarProviderLogo {...calendarProviderLogos.apple} />
              <span className="truncate text-[11px] font-medium text-gray-800">
                {calendarProviderLogos.apple.label}
              </span>
            </button>
            <button
              type="button"
              onClick={() => downloadIcsFile('evento-outlook.ics')}
              aria-label="Añadir a Outlook"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-2 transition hover:bg-gray-50"
            >
              <CalendarProviderLogo {...calendarProviderLogos.outlook} />
              <span className="truncate text-[11px] font-medium text-gray-800">
                {calendarProviderLogos.outlook.label}
              </span>
            </button>
          </div>
        ) : null}
        {renderResponseSummary()}
        {renderJustSignedUpProfileCta()}
        {!isPreview && !isLoggedIn && submittedEditToken ? (
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
        {renderPostSignupModal()}
      </>
    )
  }

  if (submittedStatus === 'declined') {
    return (
      <>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {submittedFeedbackText}
        </p>
        {renderResponseSummary()}
        {renderJustSignedUpProfileCta()}
        {!isPreview && !isLoggedIn && submittedEditToken ? (
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
        {renderPostSignupModal()}
      </>
    )
  }

  if (submittedStatus === 'maybe') {
    return (
      <>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <p className="whitespace-pre-line text-center text-sm font-medium text-gray-800">
          {submittedFeedbackText}
        </p>
        <p className="mt-2 whitespace-pre-line text-center text-xs text-gray-600">
          Guarda el enlace que aparece abajo para actualizar tu respuesta cuando lo tengas claro.
        </p>
        {renderResponseSummary()}
        {renderJustSignedUpProfileCta()}
        {!isPreview && !isLoggedIn && submittedEditToken ? (
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
        {renderPostSignupModal()}
      </>
    )
  }

  return (
    <>
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

      {!isLoggedIn && !submittedStatus && !isPreview && !signupToggle ? (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-3 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta en MiParty? Inicia sesión para pre-rellenar tu información y sincronizar el
            cumpleaños con tu perfil.
          </p>
          {renderGoogleSignupButton()}
          <div className="my-2 flex items-center gap-2">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          {showInlineLogin ? (
            <div className="space-y-2">
              {showInlineForgotPassword ? (
                <>
                  <p className="text-sm text-gray-600">
                    Escribe tu email y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={inlineForgotEmail}
                    onChange={(e) => setInlineForgotEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                  {inlineForgotError ? <p className="text-xs text-red-500">{inlineForgotError}</p> : null}
                  {inlineForgotSent ? (
                    <p className="text-center text-sm text-green-600">
                      ✅ Enlace enviado. Revisa tu bandeja de entrada.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleInlineForgotPassword()}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
                    >
                      Enviar enlace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineForgotPassword(false)
                      setInlineForgotSent(false)
                      setInlineForgotError('')
                      setInlineForgotEmail('')
                    }}
                    className="w-full text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={inlineEmail}
                    onChange={(e) => setInlineEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                  <div className="relative">
                    <input
                      type={showInlineLoginPassword ? 'text' : 'password'}
                      placeholder="Contraseña"
                      value={inlinePassword}
                      onChange={(e) => setInlinePassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInlineLoginPassword(!showInlineLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showInlineLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInlineForgotPassword(true)}
                    className="mt-1 w-full text-right text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                  {inlineLoginError ? <p className="text-xs text-red-500">{inlineLoginError}</p> : null}
                  <button
                    type="button"
                    onClick={() => void handleInlineLogin()}
                    className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
                  >
                    Iniciar sesión
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowInlineLogin(false)
                  setShowInlineForgotPassword(false)
                  setInlineForgotSent(false)
                  setInlineForgotError('')
                  setInlineForgotEmail('')
                  setInlineLoginError('')
                }}
                className="w-full text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInlineLogin(true)}
              className="w-full text-sm text-gray-500 underline hover:text-gray-700"
            >
              Iniciar sesión con email
            </button>
          )}
        </div>
      ) : null}

      {inlineLoginSuccess ? (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-700">
          ¡Bienvenido/a de vuelta! Hemos pre-rellenado tu información.
        </p>
      ) : null}


      {isPreview && attendance && helperText ? (
        <div className="flex min-h-10 items-center justify-center py-2 text-center text-gray-500">
          <p className={`whitespace-pre-line ${attendance === 'maybe' ? 'text-xs' : 'text-sm'}`}>{helperText}</p>
        </div>
      ) : null}

      {attendance ? (
        <form ref={formFieldsRef} onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Datos del invitado</p>
            <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre *
              </label>
              <input
                id="childName"
                ref={childNameInputRef}
                type="text"
                autoComplete="off"
                value={childName}
                onChange={(event) => {
                  syncChildNameFields(event.target.value, childLastRef.current)
                }}
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
                Apellido(s) *
              </label>
              <input
                id="childLastName"
                type="text"
                value={childLastName}
                onChange={(event) => {
                  syncChildNameFields(childFirstRef.current, event.target.value)
                }}
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
          </div>

          {attendance === 'confirmed' && hasFoodOptions && foodOptions.length > 0 ? (
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

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Respuesta enviada por</p>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="parentFirstName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre *
              </label>
              <input
                id="parentFirstName"
                type="text"
                autoComplete="given-name"
                value={parentFirstName}
                onChange={(event) => {
                  const v = event.target.value
                  setParentFirstName(v)
                  parentFirstNameRef.current = v
                }}
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
              <label htmlFor="parentLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Apellido(s) *
              </label>
              <input
                id="parentLastName"
                type="text"
                autoComplete="family-name"
                value={parentLastName}
                onChange={(event) => {
                  const v = event.target.value
                  setParentLastName(v)
                  parentLastNameRef.current = v
                }}
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
            </div>
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
                  onChange={(event) => setParentPhoneNumber(sanitizePhoneInput(event.target.value))}
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

          {!isLoggedIn ? (
            <div
              className={`rounded-xl border border-gray-200 p-3 ${isPreview ? 'pointer-events-none opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
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
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    signupToggle ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      signupToggle ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {signupToggle ? (
                <div className={`mt-3 space-y-2 ${isPreview ? 'pointer-events-none' : ''}`}>
                  {renderGoogleSignupButton(isPreview)}
                  <p className="text-center text-xs text-gray-500">o</p>
                  <input
                    type="email"
                    autoComplete="email"
                    disabled={isPreview}
                    placeholder="Email"
                    value={inlineSignupEmail}
                    onChange={(e) => setInlineSignupEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                  <div className="relative">
                    <input
                      type={showInlineSignupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      disabled={isPreview}
                      placeholder="Contraseña"
                      value={inlineSignupPassword}
                      onChange={(e) => setInlineSignupPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900"
                    />
                    <button
                      type="button"
                      disabled={isPreview}
                      onClick={() => setShowInlineSignupPassword(!showInlineSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showInlineSignupPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isPreview}
                    onClick={() => {
                      trackLead('rsvp_crear_cuenta')
                      trackTikTokLead('rsvp_crear_cuenta')
                      void handleEmailSignupInline()
                    }}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-gray-900 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Crear cuenta
                  </button>
                  {signupFlowError ? (
                    <p className="text-center text-xs text-red-600">{signupFlowError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isPreview && !duplicatePrompt ? (
            <button
              type="submit"
              disabled={loading || (signupToggle && !isLoggedIn)}
              className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                signupToggle && !isLoggedIn
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : `${activeTheme.button} ${activeTheme.buttonHover} text-gray-900`
              }`}
            >
              {loading
                ? 'Enviando...'
                : signupToggle && !isLoggedIn
                  ? 'Termina de registrarte para confirmar'
                  : submitText}
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
    {renderPostSignupModal()}
    </>
  )
}

export default function RsvpForm({ isPreview, ...inner }: RsvpFormProps) {
  return <RsvpFormInner {...inner} isPreview={isPreview} />
}
