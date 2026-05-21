'use client'

import AppNav from '@/components/AppNav'
import { authCardClassName } from '@/components/AuthPageShell'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSavePassword = async () => {
    setError('')
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setLoading(false)

    if (updateError) {
      setError('No se pudo guardar la contraseña. Inténtalo de nuevo.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className={`min-h-screen ${brand.pageBg}`}>
      <AppNav brandHref="/" />
      <main className="mx-auto max-w-md px-4 py-8">
        <section className={authCardClassName}>
          <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="mt-2 text-sm text-gray-500">Elige una contraseña nueva para tu cuenta.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${brand.formInput} pr-10`}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-900">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${brand.formInput} pr-10`}
                  placeholder="Repite la contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSavePassword()}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${brand.buttonPrimary}`}
            >
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
