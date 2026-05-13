import Link from 'next/link'
import AppNav from '@/components/AppNav'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/server'

export default async function NotFound() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = Boolean(user)

  return (
    <main className={`min-h-screen ${brand.pageBg}`}>
      <AppNav backHref="/" backLabel="⬅️ Inicio" />

      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-12">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-5xl" aria-hidden>
            🎈
          </p>
          <h1 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">
            ¡Ups! Esta página no existe
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            Puede que el enlace haya expirado o que la página haya sido eliminada.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-xs">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition ${brand.buttonPrimary}`}
                >
                  Ir al panel
                </Link>
                <Link
                  href="/dashboard/eventos"
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition ${brand.buttonSecondary}`}
                >
                  Ver mis eventos
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition ${brand.buttonSecondary}`}
                >
                  Volver al inicio
                </Link>
                <Link
                  href="/registro"
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold shadow-sm transition ${brand.buttonPrimary}`}
                >
                  Crear mi cuenta gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
