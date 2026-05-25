'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import AccountMenu from '@/components/AccountMenu'
import { brand } from '@/lib/brand'
import { eventFlowShellClass } from '@/lib/eventFormTheme'

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
  /** Match Paso 1/2 content width (max-w-sm) in the nav bar. */
  eventFlowLayout?: boolean
}

const DEFAULT_BACK_LABEL = '⬅️ Atrás'

export default function AppNav({
  backHref,
  backLabel = DEFAULT_BACK_LABEL,
  brandHref,
  onBackClick,
  onInternalNavigate,
  centerSlot,
  eventFlowLayout = false,
}: AppNavProps) {
  const navLeading = brandHref ? (
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
      className="text-sm text-gray-600 transition hover:text-gray-900"
    >
      {backLabel}
    </Link>
  ) : null

  const navTrailing = (
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
  )

  const navBarWidthClass = eventFlowLayout || centerSlot ? 'max-w-sm' : 'max-w-md md:max-w-6xl'

  if (centerSlot) {
    return (
      <header className={brand.navSticky}>
        <div className={eventFlowShellClass}>
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 shrink-0">{navLeading}</div>
            <div className="shrink-0">{navTrailing}</div>
          </div>
          <div className="pb-2.5">{centerSlot}</div>
        </div>
      </header>
    )
  }

  return (
    <header className={brand.navSticky}>
      <div
        className={`mx-auto flex w-full items-center justify-between px-4 py-3 ${navBarWidthClass}`}
      >
        <div className="min-w-0 shrink-0">{navLeading}</div>
        {navTrailing}
      </div>
    </header>
  )
}
