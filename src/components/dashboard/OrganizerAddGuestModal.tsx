'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizeRsvpAllergyNotesForStorage } from '@/lib/rsvpAllergyNotes'
import type { OrganizerRsvpRow } from '@/components/dashboard/OrganizerRsvpEditModal'

type AttendanceStatus = 'confirmed' | 'declined'

type FamilyChildRow = {
  id: string
  name: string
  last_name: string | null
  allergies: string | null
}

type FamilyPartnerRow = {
  id: string
  full_name: string
  last_name: string | null
}

type GuestProfileOption = {
  value: string
  label: string
  guestFirstName: string
  guestLastName: string
  allergies: string
  isFamily: boolean
}

type OrganizerAddGuestModalProps = {
  eventId: string
  enableFoodOptions: boolean
  foodOptionLabels: string[]
  primaryButtonClass: string
  onClose: () => void
  onSaved: (created: OrganizerRsvpRow) => void
  onToast: (message: string) => void
}

function displayChildName(child: FamilyChildRow) {
  const first = child.name.trim()
  const last = (child.last_name ?? '').trim()
  return last ? `${first} ${last}` : first
}

const inputClassName =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400'

export default function OrganizerAddGuestModal({
  eventId,
  enableFoodOptions,
  foodOptionLabels,
  primaryButtonClass,
  onClose,
  onSaved,
  onToast,
}: OrganizerAddGuestModalProps) {
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [accountFirstName, setAccountFirstName] = useState('')
  const [accountLastName, setAccountLastName] = useState('')
  const [accountPhone, setAccountPhone] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [partner, setPartner] = useState<FamilyPartnerRow | null>(null)
  const [children, setChildren] = useState<FamilyChildRow[]>([])

  const [attendance, setAttendance] = useState<AttendanceStatus>('confirmed')
  const [guestProfileKey, setGuestProfileKey] = useState('manual')
  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')
  const [foodPreference, setFoodPreference] = useState('')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [parentFirstName, setParentFirstName] = useState('')
  const [parentLastName, setParentLastName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const showFoodFields =
    attendance === 'confirmed' && enableFoodOptions && foodOptionLabels.length > 0

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoadingProfiles(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) {
          setLoadingProfiles(false)
        }
        return
      }

      const [{ data: userProfile }, { data: familyMembers }, { data: childRows }] = await Promise.all([
        supabase
          .from('users')
          .select('first_name, last_name, phone')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('family_members')
          .select('id, full_name, last_name, phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1),
        supabase
          .from('children')
          .select('id, name, last_name, allergies')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      if (cancelled) {
        return
      }

      const first = userProfile?.first_name?.trim() ?? ''
      const last = userProfile?.last_name?.trim() ?? ''
      const phone = userProfile?.phone?.trim() ?? ''
      const email = user.email?.trim() ?? ''

      setAccountFirstName(first)
      setAccountLastName(last)
      setAccountPhone(phone)
      setAccountEmail(email)
      setParentFirstName(first)
      setParentLastName(last)
      setParentPhone(phone)
      setParentEmail(email)
      setPartner((familyMembers?.[0] as FamilyPartnerRow | undefined) ?? null)
      setChildren((childRows ?? []) as FamilyChildRow[])
      setLoadingProfiles(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const guestProfileOptions = useMemo((): GuestProfileOption[] => {
    const options: GuestProfileOption[] = [
      {
        value: 'manual',
        label: 'Escribir manualmente',
        guestFirstName: '',
        guestLastName: '',
        allergies: '',
        isFamily: false,
      },
    ]

    if (accountFirstName || accountLastName) {
      options.push({
        value: 'account',
        label: `Titular · ${[accountFirstName, accountLastName].filter(Boolean).join(' ')}`,
        guestFirstName: accountFirstName,
        guestLastName: accountLastName,
        allergies: '',
        isFamily: true,
      })
    }

    if (partner) {
      const partnerFirst = partner.full_name.trim()
      const partnerLast = (partner.last_name ?? '').trim()
      options.push({
        value: 'partner',
        label: `Pareja · ${[partnerFirst, partnerLast].filter(Boolean).join(' ')}`,
        guestFirstName: partnerFirst,
        guestLastName: partnerLast,
        allergies: '',
        isFamily: true,
      })
    }

    for (const child of children) {
      options.push({
        value: `child:${child.id}`,
        label: displayChildName(child),
        guestFirstName: child.name.trim(),
        guestLastName: (child.last_name ?? '').trim(),
        allergies: child.allergies?.trim() ?? '',
        isFamily: true,
      })
    }

    return options
  }, [accountFirstName, accountLastName, partner, children])

  const selectedProfile = useMemo(
    () => guestProfileOptions.find((option) => option.value === guestProfileKey) ?? guestProfileOptions[0],
    [guestProfileKey, guestProfileOptions]
  )

  const handleGuestProfileChange = (value: string) => {
    setGuestProfileKey(value)
    const option = guestProfileOptions.find((item) => item.value === value)
    if (!option || value === 'manual') {
      setGuestFirstName('')
      setGuestLastName('')
      setAllergyNotes('')
      return
    }
    setGuestFirstName(option.guestFirstName)
    setGuestLastName(option.guestLastName)
    setAllergyNotes(option.allergies)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedGuestFirst = guestFirstName.trim()
    const trimmedGuestLast = guestLastName.trim()
    const trimmedParentFirst = parentFirstName.trim()
    const trimmedParentLast = parentLastName.trim()
    const trimmedParentPhone = parentPhone.trim()
    const trimmedParentEmail = parentEmail.trim()
    const trimmedFood = foodPreference.trim()
    const normalizedAllergy = normalizeRsvpAllergyNotesForStorage(allergyNotes)
    const trimmedExtra = extraNotes.trim()

    if (!trimmedGuestFirst) {
      setError('El nombre del invitado/a es obligatorio.')
      return
    }
    if (!trimmedGuestLast) {
      setError('El apellido del invitado/a es obligatorio.')
      return
    }
    if (!trimmedParentFirst) {
      setError('El nombre de quien envía la respuesta es obligatorio.')
      return
    }
    if (!trimmedParentLast) {
      setError('El apellido de quien envía la respuesta es obligatorio.')
      return
    }
    if (showFoodFields && !trimmedFood) {
      setError('Selecciona una opción de comida.')
      return
    }

    const combinedChildName = `${trimmedGuestFirst} ${trimmedGuestLast}`.trim()
    const combinedParentName = `${trimmedParentFirst} ${trimmedParentLast}`.trim()

    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('rsvps')
      .insert({
        event_id: eventId,
        child_name: combinedChildName,
        guest_parent_name: combinedParentName,
        guest_parent_phone: trimmedParentPhone || null,
        guest_parent_email: trimmedParentEmail || null,
        attendance_status: attendance,
        food_preference: showFoodFields ? trimmedFood || null : null,
        allergy_notes: showFoodFields ? normalizedAllergy : null,
        extra_notes: trimmedExtra || null,
        is_family: selectedProfile?.isFamily ?? false,
      })
      .select(
        'id, child_name, guest_parent_name, guest_parent_phone, guest_parent_email, attendance_status, food_preference, allergy_notes, extra_notes, is_family'
      )
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'No se pudo añadir la respuesta.')
      return
    }

    onSaved(data as OrganizerRsvpRow)
    onToast('Invitado añadido')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-guest-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="pr-8">
            <h2 id="add-guest-modal-title" className="text-lg font-bold text-gray-900">
              Añadir respuesta
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Registra una respuesta sin enviar el enlace de invitación.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900">¿Asistirá al evento?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAttendance('confirmed')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    attendance === 'confirmed'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  ✅ Sí, asistirá
                </button>
                <button
                  type="button"
                  onClick={() => setAttendance('declined')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    attendance === 'declined'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  ❌ No puede asistir
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Datos del invitado/a</p>

              <div>
                <label htmlFor="add-guest-profile" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Elegir desde mi perfil
                </label>
                <select
                  id="add-guest-profile"
                  value={guestProfileKey}
                  disabled={loadingProfiles}
                  onChange={(event) => handleGuestProfileChange(event.target.value)}
                  className={inputClassName}
                >
                  {guestProfileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="add-guest-first" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre *
                  </label>
                  <input
                    id="add-guest-first"
                    type="text"
                    value={guestFirstName}
                    onChange={(event) => {
                      setGuestProfileKey('manual')
                      setGuestFirstName(event.target.value)
                    }}
                    required
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label htmlFor="add-guest-last" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Apellido(s) *
                  </label>
                  <input
                    id="add-guest-last"
                    type="text"
                    value={guestLastName}
                    onChange={(event) => {
                      setGuestProfileKey('manual')
                      setGuestLastName(event.target.value)
                    }}
                    required
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            {showFoodFields ? (
              <>
                <fieldset className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Preferencia de comida *</p>
                  {foodOptionLabels.map((label) => (
                    <label key={label} className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="radio"
                        name="add-guest-food"
                        value={label}
                        checked={foodPreference === label}
                        onChange={(event) => setFoodPreference(event.target.value)}
                        className="h-4 w-4 border-gray-300 text-yellow-500 focus:ring-yellow-400"
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                <div>
                  <label htmlFor="add-guest-allergy" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Alergias o intolerancias (opcional)
                  </label>
                  <input
                    id="add-guest-allergy"
                    type="text"
                    value={allergyNotes}
                    onChange={(event) => setAllergyNotes(event.target.value)}
                    placeholder="Ej. Sin gluten, alergia a frutos secos…"
                    className={inputClassName}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Respuesta enviada por</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="add-guest-parent-first" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Nombre *
                  </label>
                  <input
                    id="add-guest-parent-first"
                    type="text"
                    value={parentFirstName}
                    onChange={(event) => setParentFirstName(event.target.value)}
                    required
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label htmlFor="add-guest-parent-last" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Apellido(s) *
                  </label>
                  <input
                    id="add-guest-parent-last"
                    type="text"
                    value={parentLastName}
                    onChange={(event) => setParentLastName(event.target.value)}
                    required
                    className={inputClassName}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="add-guest-parent-phone" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Teléfono
                </label>
                <input
                  id="add-guest-parent-phone"
                  type="tel"
                  value={parentPhone}
                  onChange={(event) => setParentPhone(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="add-guest-parent-email" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Email
                </label>
                <input
                  id="add-guest-parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <label htmlFor="add-guest-note" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nota (solo para ti)
              </label>
              <textarea
                id="add-guest-note"
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                rows={3}
                placeholder="Ej. Viene con su madre, llegará un poco tarde…"
                className={`${inputClassName} resize-y`}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="shrink-0 border-t border-gray-100 px-5 py-4">
            <button
              type="submit"
              disabled={saving || loadingProfiles}
              className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
            >
              {saving ? 'Guardando…' : 'Añadir respuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
