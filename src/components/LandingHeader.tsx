'use client'

import Link from 'next/link'
import { type MouseEvent } from 'react'
import AccountMenu from '@/components/AccountMenu'
import { brand } from '@/lib/brand'

function scrollToTopIfHome(event: MouseEvent<HTMLAnchorElement>) {
  if (typeof window !== 'undefined' && window.location.pathname === '/') {
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function scrollToSection(event: MouseEvent<HTMLAnchorElement>) {
  if (typeof window === 'undefined' || window.location.pathname !== '/') {
    return
  }

  const href = event.currentTarget.getAttribute('href')
  if (!href?.startsWith('#')) {
    return
  }

  const target = document.getElementById(href.slice(1))
  if (!target) {
    return
  }

  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingHeader() {
  return (
    <header className={`${brand.navSticky} z-40`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          onClick={scrollToTopIfHome}
          className={`text-xl font-bold ${brand.navBrand}`}
        >
          MiParty
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-gray-600 sm:flex" aria-label="Principal">
          <a href="#producto" onClick={scrollToSection} className="transition hover:text-gray-900">
            Qué es
          </a>
          <a href="#como-funciona" onClick={scrollToSection} className="transition hover:text-gray-900">
            Cómo funciona
          </a>
          <a href="#precios" onClick={scrollToSection} className="transition hover:text-gray-900">
            Precios
          </a>
        </nav>
        <AccountMenu
          signedOut={
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white/80 hover:text-gray-900 sm:inline-block"
              >
                Iniciar sesión
              </Link>
              <Link href="/registro" className={brand.landingPrimaryPill}>
                Crear cuenta
              </Link>
            </div>
          }
        />
      </div>
    </header>
  )
}
