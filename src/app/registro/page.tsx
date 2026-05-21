'use client'

import AuthPageBrand from '@/components/AuthPageBrand'
import AuthPageShell, { authCardClassName } from '@/components/AuthPageShell'
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

    const { data, error: signUpError } = await supabase.auth.signUp({
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

    const uid = data.user?.id ?? data.session?.user?.id
    if (uid) {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
      await supabase.from('users').upsert({
        id: uid,
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(' ') || null,
        signup_source: 'direct_registro',
      })
    }

    setSignupSuccess(true)
    setLoadingSignup(false)
  }

  if (signupSuccess) {
    return (
      <AuthPageShell>
        <section className={`${authCardClassName} text-center`}>
            <p className="text-3xl sm:text-4xl" aria-hidden="true">
              📬
            </p>
            <h1 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">Revisa tu correo</h1>
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
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <AuthPageBrand />
      <section className={authCardClassName}>
          <div className="mb-5 sm:mb-6">
            <p className={`text-sm font-medium ${brand.textBrand}`}>Crea tu cuenta</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Empieza en MiParty</h2>
            <p className="mt-2 text-sm text-gray-500">
              Registrate para organizar eventos y compartir momentos con amigos.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loadingGoogle || loadingSignup}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
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
    </AuthPageShell>
  )
}
