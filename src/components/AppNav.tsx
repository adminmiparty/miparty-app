'use client'

import Link from 'next/link'
import AccountMenu from '@/components/AccountMenu'
import { brand } from '@/lib/brand'

export type AppNavProps = {
  backHref?: string
  backLabel?: string
  /** Public / dashboard home: MiParty on the left linking home (no back link) */
  brandHref?: string
}

const DEFAULT_BACK_LABEL = '⬅️ Atrás'

export default function AppNav({
  backHref,
  backLabel = DEFAULT_BACK_LABEL,
  brandHref,
}: AppNavProps) {
  return (
    <header className={brand.navSticky}>
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 md:max-w-6xl">
        <div className="min-w-0 shrink-0">
          {brandHref ? (
            <Link href={brandHref} className={`text-xl font-bold ${brand.navBrand}`}>
              MiParty
            </Link>
          ) : backHref ? (
            <Link href={backHref} className="text-sm text-gray-600 transition hover:text-gray-900">
              {backLabel}
            </Link>
          ) : null}
        </div>
        <AccountMenu
          signedOut={
            brandHref ? null : (
              <Link href="/dashboard" className={`text-sm font-bold ${brand.textBrand} no-underline`}>
                MiParty
              </Link>
            )
          }
        />
      </div>
    </header>
  )
}
