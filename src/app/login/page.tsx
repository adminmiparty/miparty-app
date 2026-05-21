'use client'

import AuthPageBrand from '@/components/AuthPageBrand'
import AuthPageShell, { authCardClassName } from '@/components/AuthPageShell'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const handleForgotPassword = async () => {
    setForgotError('')
    if (!forgotEmail.trim()) {
      setForgotError('Introduce tu email')
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'https://miparty.net/auth/reset-password',
    })
    if (resetError) {
      setForgotError('No se pudo enviar el enlace. Inténtalo de nuevo.')
      return
    }
    setForgotSent(true)
  }

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

          {showForgotPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Escribe tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <input
                type="email"
                placeholder="tu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
              />
              {forgotError ? <p className="text-xs text-red-500">{forgotError}</p> : null}
              {forgotSent ? (
                <p className="text-center text-sm text-green-600">
                  ✅ Enlace enviado. Revisa tu bandeja de entrada.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold ${brand.buttonPrimary}`}
                >
                  Enviar enlace
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotSent(false)
                  setForgotError('')
                  setForgotEmail('')
                }}
                className="w-full text-xs text-gray-400 underline hover:text-gray-600"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loadingGoogle || loadingEmail}
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
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
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
                      className={`${brand.formInput} pr-10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="mt-1 w-full text-right text-xs text-gray-400 underline hover:text-gray-600"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
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
            </>
          )}

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
