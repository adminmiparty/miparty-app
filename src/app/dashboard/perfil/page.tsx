'use client'

import AppNav from '@/components/AppNav'
import GoogleGIcon from '@/components/GoogleGIcon'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

const inputClassName = brand.formInput

const emailPillClassName =
  'flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-500 cursor-default'

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

export default function ProfilePage() {
  const supabase = createClient()
  const dialRef = useRef<HTMLDivElement>(null)

  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [isGoogleAccount, setIsGoogleAccount] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [emailEditing, setEmailEditing] = useState(false)
  const [originalPhone, setOriginalPhone] = useState('')
  const [countryCode, setCountryCode] = useState<string>('+34')
  const [customDialCode, setCustomDialCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dialOpen, setDialOpen] = useState(false)

  const currentPhone = useMemo(
    () => buildFullPhone(countryCode, customDialCode, phoneNumber),
    [countryCode, customDialCode, phoneNumber]
  )

  const phoneChanged = currentPhone !== originalPhone

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
      setPageLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (isMounted) {
          setError(userError?.message ?? 'No se pudo obtener tu sesión. Vuelve a iniciar sesión.')
          setPageLoading(false)
        }
        return
      }

      const google =
        user.app_metadata?.provider === 'google' ||
        (user.identities?.some((identity) => identity.provider === 'google') ?? false)

      const { data: profile } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      const metaName = user.user_metadata?.full_name
      const resolvedName =
        (typeof profile?.full_name === 'string' && profile.full_name.trim()) ||
        (typeof metaName === 'string' && metaName.trim()) ||
        ''

      const nameParts = resolvedName.split(' ')
      const loadedFirstName = nameParts[0] || ''
      const loadedLastName = nameParts.slice(1).join(' ') || ''

      const profilePhone =
        profile?.phone != null && String(profile.phone).trim() !== ''
          ? String(profile.phone).trim()
          : ''

      setIsGoogleAccount(google)
      setFirstName(loadedFirstName)
      setLastName(loadedLastName)
      setEmail(user.email ?? '')
      setEmailEditing(false)
      setOriginalPhone(profilePhone)

      if (profilePhone) {
        const parts = splitDialPhone(profilePhone)
        setCountryCode(parts.countryCode)
        setCustomDialCode(parts.customCode)
        setPhoneNumber(parts.number)
      } else {
        setCountryCode('+34')
        setCustomDialCode('')
        setPhoneNumber('')
      }

      setPageLoading(false)
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const trimmedName = `${firstName.trim()} ${lastName.trim()}`.trim()
    if (!firstName.trim()) {
      setError('El nombre es obligatorio.')
      setSaving(false)
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'No se pudo obtener tu sesión. Vuelve a iniciar sesión.')
      setSaving(false)
      return
    }

    const google =
      user.app_metadata?.provider === 'google' ||
      (user.identities?.some((identity) => identity.provider === 'google') ?? false)

    const dial = resolveDialCode(countryCode, customDialCode)
    if (countryCode === 'otro' && dial.length <= 1 && phoneNumber.trim()) {
      setError('Indica un prefijo internacional válido.')
      setSaving(false)
      return
    }

    const fullPhone = currentPhone

    const { error: profileError } = await supabase.from('users').upsert({
      id: user.id,
      full_name: trimmedName,
      phone: fullPhone || null,
    })

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    if (!google && emailEditing) {
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        setError('El correo electrónico es obligatorio.')
        setSaving(false)
        return
      }
      if (trimmedEmail !== (user.email ?? '')) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail })
        if (emailError) {
          setError(emailError.message)
          setSaving(false)
          return
        }
      }
    }

    setOriginalPhone(fullPhone)
    setEmailEditing(false)
    setSuccess(true)
    setSaving(false)
  }

  return (
    <main className={`min-h-screen ${brand.pageBg}`}>
      <AppNav backHref="/dashboard" backLabel="⬅️ Mi panel" />
      <div className="mx-auto w-full max-w-sm px-4 py-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <div className="mb-6">
            <p className={`text-sm font-medium ${brand.textBrand}`}>Tu cuenta</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Mi perfil</h1>
          </div>

          {pageLoading ? (
            <p className="text-sm text-gray-500">Cargando perfil…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    className={inputClassName}
                    placeholder="Ej. Sofía"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Apellido(s)
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={inputClassName}
                    placeholder="Ej. García"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900">Email</label>
                {isGoogleAccount ? (
                  <div>
                    <div className={emailPillClassName}>
                      <GoogleGIcon size={20} className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 truncate">{email}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Cuenta vinculada con Google</p>
                  </div>
                ) : emailEditing ? (
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className={inputClassName}
                  />
                ) : (
                  <div className={`${emailPillClassName} justify-between gap-2`}>
                    <span className="min-w-0 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => setEmailEditing(true)}
                      className={`shrink-0 text-xs font-medium underline ${brand.accentText} ${brand.textBrandHover}`}
                    >
                      Cambiar email
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="phoneNumber" className="mb-1.5 block text-sm font-medium text-gray-900">
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
                      onChange={(event) => setCustomDialCode(sanitizeDialPrefix(event.target.value))}
                      maxLength={5}
                      placeholder="+00"
                      aria-label="Prefijo internacional"
                      className="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-[var(--brand-focus)] transition focus:border-[var(--brand-focus)] focus:ring-2"
                    />
                  ) : null}
                  <input
                    id="phoneNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="Ej. 612345678"
                    className={`min-w-0 flex-1 ${brand.formInput}`}
                  />
                </div>
                {phoneChanged ? (
                  <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    Tu nuevo número aparecerá en los próximos eventos que crees. Los eventos actuales y
                    anteriores mantendrán el número original.
                  </p>
                ) : null}
              </div>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {success ? (
                <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  Cambios guardados ✓
                </p>
              ) : null}

              <button
                type="submit"
                disabled={saving || pageLoading}
                className={brand.formSubmit}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
