'use client'

import { brand } from '@/lib/brand'
import {
  formatPersonRelationLine,
  normalizePersonRelation,
  type PersonRelation,
} from '@/lib/personRelation'
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
  relation: PersonRelation
  phone: string | null
}

function getInitials(name: string, lastName: string) {
  const first = name.trim()[0]?.toUpperCase() || ''
  const last = (lastName || '').trim()[0]?.toUpperCase() || ''
  return first + last
}

const avatarColors = [
  brand.avatarBrand,
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
]

function avatarStoragePathFromUrl(url: string): string | null {
  const match = url.match(/\/avatars\/(.+?)(?:\?|$)/)
  return match?.[1] ?? null
}

type ChildrenSectionProps = {
  userId: string
  initialChildren: DashboardChildRow[]
  isLoading: boolean
  onAddChild: () => void
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pickChildId, setPickChildId] = useState<string | null>(null)
  const [photoActionChildId, setPhotoActionChildId] = useState<string | null>(null)
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
      const publicUrlWithCache = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('children')
        .update({ avatar_url: publicUrlWithCache })
        .eq('id', childId)
        .eq('user_id', userId)

      if (updateError) {
        return
      }

      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, avatar_url: publicUrlWithCache } : c))
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

  const handleAvatarPress = (child: DashboardChildRow, hasPhoto: boolean) => {
    if (uploadingId === child.id || deletingId === child.id) {
      return
    }
    if (hasPhoto) {
      setPhotoActionChildId(child.id)
      return
    }
    openPicker(child.id)
  }

  const handleDeletePhoto = async (childId: string) => {
    const child = children.find((c) => c.id === childId)
    const avatarUrl = child?.avatar_url?.trim()
    if (!avatarUrl) {
      setPhotoActionChildId(null)
      return
    }

    setDeletingId(childId)
    try {
      const storagePath = avatarStoragePathFromUrl(avatarUrl)
      if (storagePath) {
        await supabase.storage.from('avatars').remove([storagePath])
      }

      const { error: updateError } = await supabase
        .from('children')
        .update({ avatar_url: null })
        .eq('id', childId)
        .eq('user_id', userId)

      if (updateError) {
        return
      }

      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, avatar_url: null } : c))
      )
      setPhotoActionChildId(null)
    } finally {
      setDeletingId(null)
    }
  }

  const handleReplacePhoto = (childId: string) => {
    setPhotoActionChildId(null)
    openPicker(childId)
  }

  const photoActionChild = photoActionChildId
    ? children.find((c) => c.id === photoActionChildId)
    : null

  const handleAddClick = () => {
    if (children.length >= 6) {
      setShowLimitModal(true)
    } else {
      onAddChild()
    }
  }

  return (
    <section className="mb-5 sm:mb-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={(e) => void handleFileChange(e)}
      />

      {isLoading ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Mi gente</h2>
          </div>
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
            aria-busy="true"
            aria-label="Cargando personas"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="card-soft flex min-h-[5rem] animate-pulse flex-row items-center gap-3 p-2"
              >
                <div className="h-16 w-16 shrink-0 rounded-full bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-20 rounded bg-gray-200" />
                  <div className="h-3 w-28 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : children.length === 0 ? (
        <div className="card-soft rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-gray-50/80 px-5 py-8 text-center">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Mi gente</h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-600">
            Empieza añadiendo a tus hijos/as o a las personas con las que más celebras.
          </p>
          <button type="button" onClick={handleAddClick} className={`${brand.dashboardPrimaryPill} mt-5`}>
            + Añadir persona
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Mi gente</h2>
            <button type="button" onClick={handleAddClick} className={brand.dashboardPrimaryPill}>
              + Añadir persona
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {displayed.map((child, index) => {
              const fullName = `${child.name} ${child.last_name || ''}`.trim()
              const relationLine = formatPersonRelationLine(
                normalizePersonRelation(child.relation),
                child.birth_date,
                todayDate()
              )
              const uploading = uploadingId === child.id
              const deleting = deletingId === child.id
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
                  className={`card-soft group relative flex min-h-[5rem] w-full cursor-pointer flex-row items-center gap-3 p-3 text-left transition hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px focus-visible:outline-none sm:p-2 ${brand.cardFocusRing} ${
                    isCardActive ? `shadow-[var(--shadow-card-hover)] ${brand.cardActiveRing}` : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAvatarPress(child, hasPhoto)
                    }}
                    disabled={uploading || deleting}
                    className="group/avatar relative h-16 w-16 shrink-0 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-50"
                    aria-label={hasPhoto ? 'Opciones de foto' : 'Añadir foto'}
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
                        uploading || deleting ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
                      }`}
                    >
                      {uploading || deleting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <Camera className="h-3 w-3 text-white" strokeWidth={2} aria-hidden />
                      )}
                    </div>
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-1">
                    <p
                      className="text-sm font-medium leading-snug text-gray-800 break-words sm:truncate"
                      title={fullName}
                    >
                      {fullName}
                    </p>
                    <span className="inline-flex max-w-full rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {relationLine}
                    </span>
                    {child.allergies ? (
                      <p className="line-clamp-1 text-xs leading-snug text-gray-400 break-words sm:truncate">
                        Alergias: {child.allergies}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {photoActionChild ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => {
            if (deletingId !== photoActionChild.id) {
              setPhotoActionChildId(null)
            }
          }}
        >
          <div
            className="w-full max-w-[16rem] rounded-xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="child-photo-action-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="child-photo-action-title" className="text-sm font-semibold text-gray-900">
              Foto
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={deletingId === photoActionChild.id}
                onClick={() => void handleReplacePhoto(photoActionChild.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${brand.buttonSecondary}`}
              >
                Cambiar foto
              </button>
              <button
                type="button"
                disabled={deletingId === photoActionChild.id}
                onClick={() => void handleDeletePhoto(photoActionChild.id)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === photoActionChild.id ? 'Eliminando…' : 'Eliminar foto'}
              </button>
              <button
                type="button"
                disabled={deletingId === photoActionChild.id}
                onClick={() => setPhotoActionChildId(null)}
                className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <span aria-hidden>✨</span>
              <h3 id="children-limit-title" className="text-lg font-semibold text-gray-900">
                Has llegado al máximo
              </h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Puedes guardar hasta 6 personas en Mi gente. Si necesitas más, crea otra cuenta o
              contáctanos.
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
