import Link from 'next/link'
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
      <div className="sticky top-0 z-50 w-full border-b border-gray-200 bg-yellow-50/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 md:max-w-6xl">
          <Link
            href="/dashboard"
            className={`inline-flex items-center text-sm font-medium ${brand.navText} transition ${brand.navTextHover}`}
          >
            ⬅️ Inicio
          </Link>
          {isLoggedIn ? (
            <span className={`text-sm font-bold ${brand.textBrand}`}>MiParty</span>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className={`text-sm font-medium ${brand.navText} ${brand.navTextHover}`}
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${brand.buttonPrimary}`}
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>

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
