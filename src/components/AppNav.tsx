'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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
        <div className={`min-w-0 shrink-0 text-right text-sm font-bold ${brand.textBrand}`}>
          <Link href="/dashboard" className={`${brand.textBrand} no-underline`}>
            MiParty
          </Link>
          {displayName ? <span> · {displayName}</span> : null}
        </div>
      </div>
    </header>
  )
}
