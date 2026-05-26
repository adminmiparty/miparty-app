'use client'

import AuthPageShell, { authCardClassName } from '@/components/AuthPageShell'
import { brand } from '@/lib/brand'
import { sanitizePhoneInput, validatePhoneNumber } from '@/lib/phone'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'

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

const birthDateSelectClassName = `select-base px-2 focus:ring-2 ${brand.inputFocus}`

function sanitizeDialPrefix(raw: string): string {
  const digitsPlus = raw.replace(/[^\d+]/g, '')
  if (digitsPlus.length === 0) return ''
  let body = digitsPlus.startsWith('+') ? digitsPlus.slice(1) : digitsPlus
  body = body.replace(/\+/g, '')
  return ('+' + body).slice(0, 5)
}

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

function resolveDialCode(countryCode: string, customCode: string): string {
  return countryCode === 'otro' ? sanitizeDialPrefix(customCode) : countryCode
}

function dialCodeShortLabel(code: string): string {
  if (code === '+57') return '🇨🇴 +57'
  if (code === 'otro') return '✏️ Otro'
  return '🇪🇸 +34'
}

function buildFullPhone(countryCode: string, customDialCode: string, phoneNumber: string): string {
  const dial = resolveDialCode(countryCode, customDialCode)
  const trimmedPhone = phoneNumber.replace(/\s/g, '')
  return trimmedPhone ? `${dial}${trimmedPhone}` : ''
}

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

function isoToBirthParts(iso: string | null) {
  if (!iso) {
    return { day: '', month: '', year: '' }
  }
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return { day: '', month: '', year: '' }
  }
  return { day: match[3], month: match[2], year: match[1] }
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const dialRef = useRef<HTMLDivElement>(null)

  const [pageLoading, setPageLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string>('')

  const [countryCode, setCountryCode] = useState<string>('+34')
  const [customDialCode, setCustomDialCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dialOpen, setDialOpen] = useState(false)

  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const birthYears = Array.from({ length: 101 }, (_, index) =>
    String(new Date().getFullYear() - index)
  )

  useEffect(() => {
    if (!dialOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (dialRef.current?.contains(event.target as Node)) return
      setDialOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [dialOpen])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('phone, birth_date, onboarding_completed_at, onboarding_started_at, signup_source')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profile?.onboarding_completed_at) {
        router.replace('/dashboard')
        return
      }

      if (!profile?.onboarding_started_at) {
        await supabase
          .from('users')
          .update({ onboarding_started_at: new Date().toISOString() })
          .eq('id', user.id)
          .is('onboarding_started_at', null)
      }

      const profilePhone =
        typeof profile?.phone === 'string' && profile.phone.trim() ? profile.phone.trim() : ''
      const dial = splitDialPhone(profilePhone)
      setCountryCode(dial.countryCode)
      setCustomDialCode(dial.customCode)
      setPhoneNumber(dial.number)

      const birth = isoToBirthParts(profile?.birth_date ?? null)
      setBirthDay(birth.day)
      setBirthMonth(birth.month)
      setBirthYear(birth.year)

      setUserId(user.id)
      userIdRef.current = user.id
      setPageLoading(false)
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  const handleBirthDateChange = (day: string, month: string, year: string) => {
    setBirthDay(day)
    setBirthMonth(month)
    setBirthYear(year)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!phoneNumber.trim()) {
      setError('Introduce tu teléfono')
      return
    }

    const phoneValidation = validatePhoneNumber(phoneNumber, countryCode)
    if (!phoneValidation.valid && phoneValidation.error !== null) {
      setError(phoneValidation.error)
      return
    }

    if (!birthDay || !birthMonth || !birthYear) {
      setError('Introduce tu fecha de nacimiento')
      return
    }

    const birthIso = composeBirthDateIso(birthDay, birthMonth, birthYear)
    if (!birthIso) {
      setError('Introduce tu fecha de nacimiento')
      return
    }

    const dial = resolveDialCode(countryCode, customDialCode)
    if (countryCode === 'otro' && dial.length <= 1) {
      setError('Indica un prefijo internacional válido.')
      return
    }

    const fullPhone = buildFullPhone(countryCode, customDialCode, phoneNumber)
    if (!fullPhone) {
      setError('Introduce tu teléfono')
      return
    }

    if (!userIdRef.current) return

    setSubmitting(true)

    const completedAt = new Date().toISOString()
    const { error: saveError } = await supabase.from('users').upsert({
      id: userIdRef.current,
      phone: fullPhone,
      birth_date: birthIso,
      onboarding_completed_at: completedAt,
    })

    setSubmitting(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    router.replace('/dashboard')
  }

  if (pageLoading) {
    return (
      <AuthPageShell>
        <section className={`${authCardClassName} text-center`}>
          <p className="text-sm text-gray-500">Cargando...</p>
        </section>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <section className={`${authCardClassName} text-center`}>
        <p className="text-3xl sm:text-4xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">Último paso</h1>
        <p className="mt-2 text-sm text-gray-500">Completa tu perfil para empezar</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4 text-left">
          <div>
            <label htmlFor="onboardingPhone" className="mb-1.5 block text-sm font-medium text-gray-900">
              Teléfono
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div
                ref={dialRef}
                className={
                  countryCode === 'otro'
                    ? 'relative w-20 max-w-20 shrink-0'
                    : 'relative w-28 max-w-28 shrink-0'
                }
              >
                <button
                  type="button"
                  aria-expanded={dialOpen}
                  aria-haspopup="listbox"
                  onClick={() => setDialOpen((open) => !open)}
                  className={`flex h-10 w-full items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-white px-1.5 py-2 text-left text-sm text-gray-900 outline-none ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2`}
                >
                  <span className="min-w-0 flex-1 truncate">{dialCodeShortLabel(countryCode)}</span>
                  <span className="shrink-0 text-[10px] leading-none text-gray-500" aria-hidden>
                    ▾
                  </span>
                </button>
                {dialOpen ? (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full z-[60] mt-0.5 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    <li role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={countryCode === '+34'}
                        className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                        onClick={() => {
                          setCountryCode('+34')
                          setDialOpen(false)
                        }}
                      >
                        🇪🇸 +34 (España)
                      </button>
                    </li>
                    <li role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={countryCode === '+57'}
                        className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                        onClick={() => {
                          setCountryCode('+57')
                          setDialOpen(false)
                        }}
                      >
                        🇨🇴 +57 (Colombia)
                      </button>
                    </li>
                    <li role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={countryCode === 'otro'}
                        className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                        onClick={() => {
                          setCountryCode('otro')
                          setDialOpen(false)
                        }}
                      >
                        ✏️ Otro
                      </button>
                    </li>
                  </ul>
                ) : null}
              </div>
              {countryCode === 'otro' ? (
                <input
                  type="text"
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  value={customDialCode}
                  onChange={(e) => setCustomDialCode(sanitizeDialPrefix(e.target.value))}
                  maxLength={5}
                  placeholder="+00"
                  aria-label="Prefijo internacional"
                  className="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                />
              ) : null}
              <input
                id="onboardingPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(sanitizePhoneInput(e.target.value))}
                placeholder="Ej. 612345678"
                className={`min-w-0 flex-1 ${brand.formInput}`}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 block text-sm font-medium text-gray-900">Fecha de nacimiento</p>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthDay}
                onChange={(e) => handleBirthDateChange(e.target.value, birthMonth, birthYear)}
                className={birthDateSelectClassName}
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
                value={birthMonth}
                onChange={(e) => handleBirthDateChange(birthDay, e.target.value, birthYear)}
                className={birthDateSelectClassName}
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
                value={birthYear}
                onChange={(e) => handleBirthDateChange(birthDay, birthMonth, e.target.value)}
                className={birthDateSelectClassName}
                aria-label="Año"
              >
                <option value="">Año</option>
                {birthYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className={brand.formSubmit}>
            {submitting ? 'Guardando...' : 'Ir a MiParty'}
          </button>
        </form>
      </section>
    </AuthPageShell>
  )
}
