'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import AccountMenu from '@/components/AccountMenu'
import { brand } from '@/lib/brand'

export type AppNavProps = {
  backHref?: string
  backLabel?: string
  /** Public / dashboard home: MiParty on the left linking home (no back link) */
  brandHref?: string
  /** If set, called before navigating to `backHref`. Call `preventDefault()` to cancel navigation. */
  onBackClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  /** Intercept in-app nav links (e.g. account menu). Call `preventDefault()` to cancel navigation. */
  onInternalNavigate?: (href: string, event: MouseEvent<HTMLAnchorElement>) => void
  /** Compact center content (e.g. event creation step progress). */
  centerSlot?: ReactNode
}

const DEFAULT_BACK_LABEL = '⬅️ Atrás'

export default function AppNav({
  backHref,
  backLabel = DEFAULT_BACK_LABEL,
  brandHref,
  onBackClick,
  onInternalNavigate,
  centerSlot,
}: AppNavProps) {
  return (
    <header className={brand.navSticky}>
      <div
        className={`mx-auto flex w-full max-w-md items-center px-4 py-3 md:max-w-6xl ${
          centerSlot ? 'gap-2' : 'justify-between'
        }`}
      >
        <div className={centerSlot ? 'min-w-0 max-w-[34%] shrink-0 sm:max-w-[38%]' : 'min-w-0 shrink-0'}>
          {brandHref ? (
            <Link href={brandHref} className={`text-xl font-bold ${brand.navBrand}`}>
              MiParty
            </Link>
          ) : backHref ? (
            <Link
              href={backHref}
              onClick={(e) => {
                onBackClick?.(e)
                if (!e.defaultPrevented && onInternalNavigate) {
                  onInternalNavigate(backHref, e)
                }
              }}
              className={`text-sm text-gray-600 transition hover:text-gray-900 ${
                centerSlot ? 'line-clamp-2 leading-snug' : ''
              }`}
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
        {centerSlot ? <div className="min-w-0 flex-1">{centerSlot}</div> : null}
        <div className="shrink-0">
          <AccountMenu
            onInternalNavigate={onInternalNavigate}
            signedOut={
              brandHref ? null : (
                <Link href="/dashboard" className={`text-sm font-bold ${brand.textBrand} no-underline`}>
                  MiParty
                </Link>
              )
            }
          />
        </div>
      </div>
    </header>
  )
}
