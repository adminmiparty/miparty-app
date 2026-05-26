'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackLandingCrearCuentaClick } from '@/components/landing/LandingMetaTracking'
import { brand } from '@/lib/brand'

export default function LandingFooter() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const syncSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsLoggedIn(Boolean(user))
    }

    void syncSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncSession()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center text-sm sm:px-6">
        <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
          <p className={`text-base font-bold ${brand.navBrand}`}>MiParty</p>
          <p className="text-[var(--brand-text-secondary)]">
            Creado por una familia para todas las familias.
          </p>
          {!isLoggedIn ? (
            <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
              <Link
                href="/login"
                className="text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-text)]"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={trackLandingCrearCuentaClick}
                className="text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-text)]"
              >
                Crear cuenta
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[var(--brand-text-muted)]">
          <Link
            href="/privacy"
            className="font-medium text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-accent-dark)]"
          >
            Política de privacidad
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/terms"
            className="font-medium text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-accent-dark)]"
          >
            Términos del servicio
          </Link>
        </div>
      </div>
    </footer>
  )
}
