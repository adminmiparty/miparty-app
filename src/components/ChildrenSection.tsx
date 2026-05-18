'use client'

import { brand } from '@/lib/brand'
import { Camera, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type DashboardChildRow = {
  id: string
  name: string
  last_name: string | null
  birth_date: string | null
  avatar_url: string | null
  short_name: string | null
  allergies: string | null
}

function formatBirthDdMmYyyy(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return ''
  }
  const [, y, m, d] = match
  return `${d}/${m}/${y}`
}

function computeAgeYears(birthIso: string, today: Date): number {
  const [y, mo, d] = birthIso.split('-').map((value) => Number.parseInt(value, 10))
  const birth = new Date(y, mo - 1, d)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

const avatarColors = [
  'bg-yellow-100 text-yellow-700',
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
]

function getInitials(name: string, lastName: string) {
  const first = name.trim()[0]?.toUpperCase() || ''
  const last = (lastName || '').trim()[0]?.toUpperCase() || ''
  return first + last
}

type ChildrenSectionProps = {
  userId: string
  initialChildren: DashboardChildRow[]
  isLoading: boolean
  onAddChild: () => void
  /** Card click — opens child action modal */
  onChildCardPress: (child: DashboardChildRow) => void
  childActionTargetId?: string | null
}

export function ChildrenSection({
  userId,
  initialChildren,
  isLoading,
  onAddChild,
  onChildCardPress,
  childActionTargetId = null,
}: ChildrenSectionProps) {
  const supabase = createClient()
  const [children, setChildren] = useState<DashboardChildRow[]>(initialChildren)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [pickChildId, setPickChildId] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const todayDate = useCallback(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])

  useEffect(() => {
    setChildren(initialChildren)
  }, [initialChildren])

  const displayed = children.slice(0, 6)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const childId = pickChildId
    e.target.value = ''
    setPickChildId(null)
    if (!file || !childId || !file.type.startsWith('image/')) {
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    const safeExt = ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
    const path = `children/${childId}.${safeExt}`

    setUploadingId(childId)
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type,
      })
      if (uploadError) {
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('children')
        .update({ avatar_url: publicUrl })
        .eq('id', childId)
        .eq('user_id', userId)

      if (updateError) {
        return
      }

      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, avatar_url: publicUrl } : c))
      )
    } finally {
      setUploadingId(null)
    }
  }

  const openPicker = (childId: string) => {
    setPickChildId(childId)
    requestAnimationFrame(() => {
      fileInputRef.current?.click()
    })
  }

  return (
    <section className="mb-6 sm:mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Mis hijos/as</h2>
        <button
          type="button"
          onClick={() => {
            if (children.length >= 6) {
              setShowLimitModal(true)
            } else {
              onAddChild()
            }
          }}
          className={brand.dashboardPrimaryPill}
        >
          Añadir hijo/a
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={(e) => void handleFileChange(e)}
      />
      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando hijos…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {displayed.map((child, index) => {
            const fullName = `${child.name} ${child.last_name || ''}`.trim()
            const birth = child.birth_date?.trim()
            const age = birth ? computeAgeYears(birth, todayDate()) : null
            const birthFmt = birth ? formatBirthDdMmYyyy(birth) : ''
            const uploading = uploadingId === child.id
            const hasPhoto = Boolean(child.avatar_url?.trim())
            const initials = getInitials(child.name, child.last_name ?? '')
            const avatarColorClass = avatarColors[index % avatarColors.length]
            const isCardActive = childActionTargetId === child.id
            return (
              <div
                key={child.id}
                role="button"
                tabIndex={0}
                onClick={() => onChildCardPress(child)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChildCardPress(child)
                  }
                }}
                aria-label={`Opciones de ${fullName}`}
                aria-haspopup="menu"
                aria-expanded={isCardActive}
                className={`card-soft group relative flex min-h-[5rem] w-full cursor-pointer flex-row items-center gap-3 p-2 text-left transition hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 ${
                  isCardActive ? 'shadow-[var(--shadow-card-hover)] ring-2 ring-yellow-300/80' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openPicker(child.id)
                  }}
                  disabled={uploading}
                  className="group/avatar relative h-16 w-16 shrink-0 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-50"
                  aria-label={hasPhoto ? 'Cambiar foto' : 'Añadir foto'}
                >
                  {hasPhoto ? (
                    <img
                      src={child.avatar_url!}
                      alt=""
                      className="avatar-soft h-16 w-16 rounded-full border border-dashed border-gray-300"
                    />
                  ) : (
                    <div
                      className={`avatar-soft flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-gray-300 text-base font-semibold ${avatarColorClass}`}
                    >
                      {initials || '?'}
                    </div>
                  )}
                  <div
                    className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/30 transition-opacity ${
                      uploading ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
                    }`}
                  >
                    {uploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Camera className="h-3 w-3 text-white" strokeWidth={2} aria-hidden />
                    )}
                  </div>
                </button>
                <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-0.5">
                  <p className="truncate text-sm font-medium text-gray-700" title={fullName}>
                    {fullName}
                  </p>
                  {birth ? (
                    <p className="truncate text-xs text-gray-400">
                      {age != null ? `${age} años · ${birthFmt}` : birthFmt}
                    </p>
                  ) : (
                    <p className="text-xs italic text-gray-300">Fecha de nacimiento no añadida</p>
                  )}
                  {child.allergies ? (
                    <p className="truncate text-xs text-gray-400">Alergias: {child.allergies}</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showLimitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="children-limit-title"
          >
            <button
              type="button"
              onClick={() => setShowLimitModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <div className="flex items-center gap-2">
              <span aria-hidden>👶</span>
              <h3 id="children-limit-title" className="text-lg font-semibold text-gray-900">
                Has llegado al máximo
              </h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Has llegado al máximo de 6 perfiles infantiles. Si necesitas añadir más, te invitamos a crear
              otra cuenta o contactarnos.
            </p>
            <button
              type="button"
              onClick={() => setShowLimitModal(false)}
              className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
