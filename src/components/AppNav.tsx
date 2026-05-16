'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { brand } from '@/lib/brand'

export type AppNavProps = {
  backHref?: string
  backLabel?: string
}

const DEFAULT_BACK_LABEL = '⬅️ Atrás'

function extractName(user: User): string | null {
  const full = user.user_metadata?.full_name as string | undefined
  return full?.split(' ')[0] || user.email?.split('@')[0] || null
}

export default function AppNav({ backHref, backLabel = DEFAULT_BACK_LABEL }: AppNavProps) {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setDisplayName(extractName(user))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setDisplayName(extractName(session.user))
      } else {
        setDisplayName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-yellow-50/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 md:max-w-6xl">
        <div className="min-w-0 shrink-0">
          {backHref ? (
            <Link href={backHref} className="text-sm text-gray-600 transition hover:text-gray-900">
              {backLabel}
            </Link>
          ) : null}
        </div>
        <div className="relative min-w-0 shrink-0 text-right" ref={dropdownRef}>
          {displayName ? (
            <>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-1 text-sm font-bold ${brand.textBrand}`}
              >
                MiParty · {displayName}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showDropdown ? (
                <div className="absolute right-4 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <Link href="/dashboard" className={`text-sm font-bold ${brand.textBrand} no-underline`}>
              MiParty
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
