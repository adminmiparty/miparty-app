'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AttendanceStatus = 'confirmed' | 'declined' | 'maybe'

export type OrganizerRsvpRow = {
  id: string
  child_name: string
  guest_parent_name: string
  guest_parent_phone: string | null
  guest_parent_email: string | null
  attendance_status: AttendanceStatus | null
  food_preference: string | null
  allergy_notes: string | null
  extra_notes: string | null
  is_family: boolean | null
}

type OrganizerRsvpEditModalProps = {
  rsvp: OrganizerRsvpRow
  eventId: string
  enableFoodOptions: boolean
  foodOptionLabels: string[]
  primaryButtonClass: string
  onClose: () => void
  onSaved: (updated: OrganizerRsvpRow) => void
  onDeleted: (id: string) => void
  onToast: (message: string) => void
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'confirmed', label: '✅ Confirmado' },
  { value: 'declined', label: '❌ No puede' },
]

export default function OrganizerRsvpEditModal({
  rsvp,
  eventId,
  enableFoodOptions,
  foodOptionLabels,
  primaryButtonClass,
  onClose,
  onSaved,
  onDeleted,
  onToast,
}: OrganizerRsvpEditModalProps) {
  const [childName, setChildName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [attendance, setAttendance] = useState<AttendanceStatus>('confirmed')
  const [foodPreference, setFoodPreference] = useState('')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'actions' | 'form' | 'delete'>('actions')

  const showFoodFields =
    enableFoodOptions && foodOptionLabels.length > 0 && attendance === 'confirmed'

  useEffect(() => {
    setChildName(rsvp.child_name.trim())
    setParentName(rsvp.guest_parent_name.trim())
    setParentPhone((rsvp.guest_parent_phone ?? '').trim())
    setParentEmail((rsvp.guest_parent_email ?? '').trim())
    setAttendance(
      rsvp.attendance_status === 'confirmed' ||
        rsvp.attendance_status === 'declined' ||
        rsvp.attendance_status === 'maybe'
        ? rsvp.attendance_status
        : 'confirmed'
    )
    setFoodPreference((rsvp.food_preference ?? '').trim())
    setAllergyNotes((rsvp.allergy_notes ?? '').trim())
    setExtraNotes((rsvp.extra_notes ?? '').trim())
    setError('')
    setView('actions')
  }, [rsvp])

  const attendanceOptions = useMemo(() => {
    const options = [...ATTENDANCE_OPTIONS]
    if (rsvp.attendance_status === 'maybe' && !options.some((o) => o.value === 'maybe')) {
      options.push({ value: 'maybe', label: '🤔 Aún no sabe (respuesta antigua)' })
    }
    return options
  }, [rsvp.attendance_status])

  async function handleSave() {
    const trimmedChild = childName.trim()
    const trimmedParent = parentName.trim()
    const trimmedPhone = parentPhone.trim()
    const trimmedEmail = parentEmail.trim()
    const trimmedFood = foodPreference.trim()
    const trimmedAllergy = allergyNotes.trim()
    const trimmedExtra = extraNotes.trim()

    if (!trimmedChild) {
      setError('El nombre del niño/a es obligatorio.')
      return
    }
    if (!trimmedParent) {
      setError('El nombre del padre/madre es obligatorio.')
      return
    }
    if (showFoodFields && !trimmedFood) {
      setError('Selecciona una opción de comida.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      child_name: trimmedChild,
      guest_parent_name: trimmedParent,
      guest_parent_phone: trimmedPhone || null,
      guest_parent_email: trimmedEmail || null,
      attendance_status: attendance,
      food_preference: showFoodFields ? trimmedFood || null : null,
      allergy_notes: showFoodFields ? trimmedAllergy || null : null,
      extra_notes: trimmedExtra || null,
    }

    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('rsvps')
      .update(payload)
      .eq('id', rsvp.id)
      .eq('event_id', eventId)
      .select(
        'id, child_name, guest_parent_name, guest_parent_phone, guest_parent_email, attendance_status, food_preference, allergy_notes, extra_notes, is_family'
      )
      .single()

    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message ?? 'No se pudieron guardar los cambios.')
      return
    }

    onSaved(data as OrganizerRsvpRow)
    onToast('Cambios guardados')
    onClose()
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    setError('')

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('rsvps')
      .delete()
      .eq('id', rsvp.id)
      .eq('event_id', eventId)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setView('actions')
      return
    }

    onDeleted(rsvp.id)
    onToast('Invitado eliminado')
    onClose()
  }

  if (view === 'delete') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="presentation"
        onClick={() => !deleting && setView('actions')}
      >
        <div
          className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="rsvp-delete-confirm-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="rsvp-delete-confirm-title" className="text-lg font-bold text-gray-900">
            ¿Eliminar invitado?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Vas a eliminar la respuesta de <span className="font-medium text-gray-900">{childName.trim() || rsvp.child_name}</span>.
            Esta acción no se puede deshacer.
          </p>
          {rsvp.is_family ? (
            <p className="mt-2 text-sm text-amber-800">
              Este invitado está vinculado a tu familia en el evento. Eliminarlo quitará su entrada de la lista.
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Eliminando…' : 'Sí, eliminar invitado'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setView('actions')}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const shellClassName =
    'relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl'

  if (view === 'actions') {
    const displayName = rsvp.child_name.trim()
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className={shellClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rsvp-actions-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="pr-8">
              <h2 id="rsvp-actions-modal-title" className="text-lg font-bold text-gray-900">
                Invitado
              </h2>
              {displayName ? <p className="mt-0.5 text-sm text-gray-500">{displayName}</p> : null}
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
          <div className="space-y-2 px-5 py-5">
            <button
              type="button"
              onClick={() => setView('form')}
              className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${primaryButtonClass}`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setView('delete')}
              className="w-full rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={shellClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1 pr-8">
            <button
              type="button"
              onClick={() => setView('actions')}
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              ← Volver
            </button>
            <h2 id="rsvp-edit-modal-title" className="mt-1 text-lg font-bold text-gray-900">
              Editar invitado
            </h2>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-rsvp-child" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre del niño/a *
              </label>
              <input
                id="edit-rsvp-child"
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div>
              <label htmlFor="edit-rsvp-parent" className="mb-1.5 block text-sm font-medium text-gray-900">
                Padre/madre responsable *
              </label>
              <input
                id="edit-rsvp-parent"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div>
              <label htmlFor="edit-rsvp-phone" className="mb-1.5 block text-sm font-medium text-gray-900">
                Teléfono
              </label>
              <input
                id="edit-rsvp-phone"
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div>
              <label htmlFor="edit-rsvp-email" className="mb-1.5 block text-sm font-medium text-gray-900">
                Email
              </label>
              <input
                id="edit-rsvp-email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900">Estado *</p>
              <div className="flex flex-wrap gap-2">
                {attendanceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAttendance(option.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      attendance === option.value
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {showFoodFields ? (
              <>
                <div>
                  <label htmlFor="edit-rsvp-food" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Comida *
                  </label>
                  <select
                    id="edit-rsvp-food"
                    value={foodPreference}
                    onChange={(e) => setFoodPreference(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="">Seleccionar…</option>
                    {foodOptionLabels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                    {foodPreference && !foodOptionLabels.includes(foodPreference) ? (
                      <option value={foodPreference}>{foodPreference}</option>
                    ) : null}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-rsvp-allergy" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Alergias e intolerancias
                  </label>
                  <input
                    id="edit-rsvp-allergy"
                    type="text"
                    value={allergyNotes}
                    onChange={(e) => setAllergyNotes(e.target.value)}
                    placeholder="Ej. Gluten, frutos secos…"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label htmlFor="edit-rsvp-message" className="mb-1.5 block text-sm font-medium text-gray-900">
                Mensaje
              </label>
              <textarea
                id="edit-rsvp-message"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonClass}`}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
