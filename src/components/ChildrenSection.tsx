'use client'

import { ClickableAvatar } from '@/components/ClickableAvatar'
import { brand } from '@/lib/brand'
import { removeAvatarFile, safeImageExtension, uploadAvatarFile } from '@/lib/avatarStorage'
import {
  formatPersonRelationLine,
  normalizePersonRelation,
  type PersonRelation,
} from '@/lib/personRelation'
import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

type ChildrenSectionProps = {
  userId: string
  initialChildren: DashboardChildRow[]
  isLoading: boolean
  onAddChild: () => void
  onChildCardPress: (child: DashboardChildRow) => void
  childActionTargetId?: string | null
  onChildrenChange?: (children: DashboardChildRow[]) => void
}

export function ChildrenSection({
  userId,
  initialChildren,
  isLoading,
  onAddChild,
  onChildCardPress,
  childActionTargetId = null,
  onChildrenChange,
}: ChildrenSectionProps) {
  const supabase = createClient()
  const [children, setChildren] = useState<DashboardChildRow[]>(initialChildren)
  const [showLimitModal, setShowLimitModal] = useState(false)

  const todayDate = useCallback(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])

  useEffect(() => {
    setChildren(initialChildren)
  }, [initialChildren])

  const updateChildren = (updater: (prev: DashboardChildRow[]) => DashboardChildRow[]) => {
    setChildren((prev) => {
      const next = updater(prev)
      onChildrenChange?.(next)
      return next
    })
  }

  const handleChildAvatarUpload = async (childId: string, file: File) => {
    const ext = safeImageExtension(file.name)
    const path = `children/${childId}.${ext}`
    const result = await uploadAvatarFile(supabase, path, file)
    if ('error' in result) {
      return null
    }

    const { error: updateError } = await supabase
      .from('children')
      .update({ avatar_url: result.publicUrl })
      .eq('id', childId)
      .eq('user_id', userId)

    if (updateError) {
      return null
    }

    updateChildren((prev) =>
      prev.map((c) => (c.id === childId ? { ...c, avatar_url: result.publicUrl } : c))
    )
    return result.publicUrl
  }

  const handleChildAvatarDelete = async (childId: string) => {
    const child = children.find((c) => c.id === childId)
    const avatarUrl = child?.avatar_url?.trim()
    if (!avatarUrl) {
      return
    }

    await removeAvatarFile(supabase, avatarUrl)

    const { error: updateError } = await supabase
      .from('children')
      .update({ avatar_url: null })
      .eq('id', childId)
      .eq('user_id', userId)

    if (updateError) {
      return
    }

    updateChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, avatar_url: null } : c)))
  }

  const displayed = children.slice(0, 6)

  const handleAddClick = () => {
    if (children.length >= 6) {
      setShowLimitModal(true)
    } else {
      onAddChild()
    }
  }

  return (
    <section className="mb-5 sm:mb-8">
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
              const initials = getInitials(child.name, child.last_name ?? '')
              const avatarColorClass = avatarColors[index % avatarColors.length]
              const isCardActive = childActionTargetId === child.id
              return (
                <div
                  key={child.id}
                  className={`card-soft group relative flex min-h-[5rem] w-full flex-row items-center gap-3 p-3 text-left transition sm:p-2 ${
                    isCardActive ? `shadow-[var(--shadow-card-hover)] ${brand.cardActiveRing}` : ''
                  }`}
                >
                  <ClickableAvatar
                    imageUrl={child.avatar_url}
                    initials={initials || '?'}
                    initialsClassName={avatarColorClass}
                    onUpload={(file) => handleChildAvatarUpload(child.id, file)}
                    onDelete={
                      child.avatar_url?.trim()
                        ? () => handleChildAvatarDelete(child.id)
                        : undefined
                    }
                  />
                  <div
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
                    className={`flex min-w-0 flex-1 cursor-pointer flex-col items-start justify-start gap-1 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] ${brand.cardFocusRing}`}
                  >
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
