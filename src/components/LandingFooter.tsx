'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-gray-500 sm:flex-row sm:px-6 sm:text-left">
        <p className={`text-base font-bold ${brand.navBrand}`}>MiParty</p>
        <p className="text-gray-500">Creado por una familia para todas las familias.</p>
        {!isLoggedIn ? (
          <div className="flex gap-4">
            <Link href="/login" className="transition hover:text-gray-900">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="transition hover:text-gray-900">
              Crear cuenta
            </Link>
          </div>
        ) : null}
      </div>
    </footer>
  )
}
