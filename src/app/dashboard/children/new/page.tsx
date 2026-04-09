'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NewChildPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(userError?.message ?? 'No se pudo obtener tu sesión. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('children').insert({
      user_id: user.id,
      name: name.trim(),
      birth_date: birthDate,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center text-sm font-medium text-yellow-600 hover:text-yellow-700"
        >
          ← Volver al panel
        </Link>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <div className="mb-6">
            <p className="text-sm font-medium text-yellow-500">Perfil infantil</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Añadir hijo o hija</h1>
            <p className="mt-2 text-sm text-gray-500">
              Guarda el nombre y la fecha de nacimiento para organizar sus fiestas.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                Nombre del niño o de la niña
              </label>
              <input
                id="childName"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                placeholder="Ej. Sofía"
              />
            </div>

            <div>
              <label htmlFor="birthDate" className="mb-1.5 block text-sm font-medium text-gray-900">
                Fecha de nacimiento
              </label>
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
