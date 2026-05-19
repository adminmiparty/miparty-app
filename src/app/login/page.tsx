'use client'

import AuthPageBrand from '@/components/AuthPageBrand'
import AuthPageShell, { authCardClassName } from '@/components/AuthPageShell'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
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

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoadingEmail(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoadingEmail(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <AuthPageShell>
      <AuthPageBrand />
      <section className={authCardClassName}>
          <div className="mb-5 sm:mb-6">
            <p className={`text-sm font-medium ${brand.textBrand}`}>Bienvenido a MiParty</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Inicia sesion</h2>
            <p className="mt-2 text-sm text-gray-500">
              Accede para gestionar tus eventos y ver tu panel.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loadingEmail}
            className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingGoogle ? 'Conectando con Google...' : 'Continuar con Google'}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">o con correo</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                onInvalid={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('Por favor, completa este campo.')
                }}
                onInput={(e) => {
                  (e.target as HTMLInputElement).setCustomValidity('')
                }}
                className={brand.formInput}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loadingEmail || loadingGoogle}
              className={brand.formSubmit}
            >
              {loadingEmail ? 'Iniciando sesion...' : 'Entrar con correo'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            No tienes cuenta?{' '}
            <Link href="/registro" className={brand.linkBrand}>
              Crear cuenta
            </Link>
          </p>
      </section>
    </AuthPageShell>
  )
}
