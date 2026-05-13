'use client'

import { Camera, Plus } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

export type DashboardChildRow = {
  id: string
  name: string
  last_name: string | null
  birth_date: string | null
  avatar_url: string | null
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

function childDisplayName(child: DashboardChildRow) {
  const first = child.name.trim()
  const last = (child.last_name ?? '').trim()
  if (!last) {
    return first
  }
  return `${first} ${last}`.trim()
}

type ChildrenSectionProps = {
  userId: string
  initialChildren: DashboardChildRow[]
  isLoading: boolean
}

export function ChildrenSection({ userId, initialChildren, isLoading }: ChildrenSectionProps) {
  const supabase = createClient()
  const [children, setChildren] = useState<DashboardChildRow[]>(initialChildren)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [pickChildId, setPickChildId] = useState<string | null>(null)
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
        <Link
          href="/dashboard/hijos/nuevo"
          className={`inline-flex shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-yellow-50 ${brand.accentText} ${brand.textBrandHover}`}
          aria-label="Añadir hijo/a"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </Link>
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
          {displayed.map((child) => {
            const display = childDisplayName(child)
            const birth = child.birth_date?.trim()
            const age = birth ? computeAgeYears(birth, todayDate()) : null
            const birthFmt = birth ? formatBirthDdMmYyyy(birth) : ''
            const uploading = uploadingId === child.id
            let line2 = ''
            if (age != null && birthFmt) {
              line2 = `${age} años · ${birthFmt}`
            } else if (age != null) {
              line2 = `${age} años`
            } else if (birthFmt) {
              line2 = birthFmt
            }
            return (
              <div
                key={child.id}
                className="relative flex min-h-[7.5rem] flex-row items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
              >
                <div className="relative h-16 w-16 shrink-0">
                  {child.avatar_url ? (
                    <button
                      type="button"
                      onClick={() => openPicker(child.id)}
                      disabled={uploading}
                      className="group relative h-16 w-16 cursor-pointer overflow-hidden rounded-full border-0 p-0 disabled:opacity-50"
                      aria-label="Cambiar foto"
                    >
                      <img
                        src={child.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/30 transition ${
                          uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {uploading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <Camera className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
                        )}
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPicker(child.id)}
                      disabled={uploading}
                      className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200 disabled:opacity-50"
                      aria-label="Añadir foto"
                    >
                      {uploading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      ) : (
                        <Camera className="h-5 w-5 text-gray-400" strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-1 text-left">
                  <p className="truncate text-sm font-medium text-gray-900" title={display}>
                    {display}
                  </p>
                  {line2 ? <p className="mt-0.5 truncate text-xs text-gray-400">{line2}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
