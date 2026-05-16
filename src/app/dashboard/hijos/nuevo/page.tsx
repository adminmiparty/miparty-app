'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import AppNav from '@/components/AppNav'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function composeBirthDateIso(day: string, month: string, year: string): string {
  if (!day || !month || !year) {
    return ''
  }
  const dayNumber = Number.parseInt(day, 10)
  const monthNumber = Number.parseInt(month, 10)
  const yearNumber = Number.parseInt(year, 10)
  if (
    Number.isNaN(dayNumber) ||
    Number.isNaN(monthNumber) ||
    Number.isNaN(yearNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return ''
  }
  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber)
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() + 1 !== monthNumber ||
    parsed.getDate() !== dayNumber
  ) {
    return ''
  }
  return `${year}-${month}-${day}`
}

const birthDateSelectClassName =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition focus:border-yellow-400 focus:ring-2'

export default function NewChildPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const handleBirthDateChange = (day: string, month: string, year: string) => {
    setBirthDay(day)
    setBirthMonth(month)
    setBirthYear(year)
    setBirthDate(composeBirthDateIso(day, month, year))
  }

  const birthYears = Array.from({ length: 101 }, (_, index) =>
    String(new Date().getFullYear() - index)
  )

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
      short_name: shortName.trim() || null,
      last_name: lastName.trim() || null,
      birth_date: birthDate,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setShowSuccessToast(true)
    setLoading(false)
    window.setTimeout(() => {
      router.push('/dashboard')
    }, 1500)
  }

  return (
    <main className={`min-h-screen ${brand.pageBg}`}>
      <AppNav backHref="/dashboard" backLabel="⬅️ Mi espacio" />
      <div className="mx-auto w-full max-w-sm px-4 py-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
          <div className="mb-6">
            <p className={`text-sm font-medium ${brand.textBrand}`}>Tu cuenta</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Añadir hijo/a</h1>
            <p className="mt-2 text-sm text-gray-500">
              Organiza cumpleaños y eventos más rápido en el futuro.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="childName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Nombre
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
                <label htmlFor="childLastName" className="mb-1.5 block text-sm font-medium text-gray-900">
                  Apellido(s)
                </label>
                <input
                  id="childLastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                  placeholder="Ej. García"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <label htmlFor="childShortName" className="text-sm font-medium text-gray-700">
                  Nombre corto o apodo
                </label>
                <span className="text-xs text-gray-400">Opcional</span>
              </div>
              <input
                id="childShortName"
                type="text"
                value={shortName}
                onChange={(event) => setShortName(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-yellow-400 transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2"
                placeholder="Ej. Sofi"
              />
            </div>

            <div>
              <label htmlFor="birthDay" className="mb-1.5 block text-sm font-medium text-gray-900">
                Fecha de nacimiento
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  id="birthDay"
                  value={birthDay}
                  onChange={(event) => handleBirthDateChange(event.target.value, birthMonth, birthYear)}
                  required
                  className={birthDateSelectClassName}
                  aria-label="Día"
                >
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(event) => handleBirthDateChange(birthDay, event.target.value, birthYear)}
                  required
                  className={birthDateSelectClassName}
                  aria-label="Mes"
                >
                  <option value="">Mes</option>
                  {SPANISH_MONTHS.map((monthName, index) => {
                    const monthValue = String(index + 1).padStart(2, '0')
                    return (
                      <option key={monthValue} value={monthValue}>
                        {monthName}
                      </option>
                    )
                  })}
                </select>
                <select
                  value={birthYear}
                  onChange={(event) => handleBirthDateChange(birthDay, birthMonth, event.target.value)}
                  required
                  className={birthDateSelectClassName}
                  aria-label="Año"
                >
                  <option value="">Año</option>
                  {birthYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
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
              {loading ? 'Guardando...' : 'Guardar hijo/a'}
            </button>
          </form>
        </section>
      </div>
      {showSuccessToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          🎉 Perfil añadido
        </div>
      ) : null}
    </main>
  )
}
