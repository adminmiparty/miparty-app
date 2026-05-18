'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingSignup, setLoadingSignup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleGoogleSignup = async () => {
    setError(null)
    setLoadingGoogle(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoadingGoogle(false)
    }
  }

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoadingSignup(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoadingSignup(false)
      return
    }

    setSignupSuccess(true)
    setLoadingSignup(false)
  }

  if (signupSuccess) {
    return (
      <main className={`min-h-screen ${brand.pageBg} px-4 py-8`}>
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm items-center justify-center">
          <section className="w-full rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-xl">
            <p className="text-4xl" aria-hidden="true">
              📬
            </p>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-gray-500">
              Te enviamos un enlace de confirmacion. Abre tu email para activar tu cuenta de
              MiParty.
            </p>
            <p className="mt-6 text-sm text-gray-500">
              Ya tienes cuenta?{' '}
              <Link href="/login" className={brand.linkBrand}>
                Iniciar sesion
              </Link>
            </p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className={`min-h-screen ${brand.pageBg} px-4 py-8`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col items-center justify-center gap-5">
        <div className="text-center">
          <p className="text-4xl" aria-hidden="true">
            🎉
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">MiParty</h1>
          <p className="mt-1 text-sm text-gray-500">Organiza fiestas sin el caos</p>
        </div>

        <section className="w-full rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <div className="mb-6">
            <p className={`text-sm font-medium ${brand.textBrand}`}>Crea tu cuenta</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">Empieza en MiParty</h2>
            <p className="mt-2 text-sm text-gray-500">
              Registrate para organizar eventos y compartir momentos con amigos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loadingGoogle || loadingSignup}
            className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingGoogle ? 'Conectando con Google...' : 'Continuar con Google'}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">o con correo</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre completo
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                className={brand.formInput}
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-900">
                Correo electronico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                className={brand.formInput}
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-900">
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                className={brand.formInput}
                placeholder="Minimo 6 caracteres"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loadingSignup || loadingGoogle}
              className={brand.formSubmit}
            >
              {loadingSignup ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Ya tienes cuenta?{' '}
            <Link href="/login" className={brand.linkBrand}>
              Iniciar sesion
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
