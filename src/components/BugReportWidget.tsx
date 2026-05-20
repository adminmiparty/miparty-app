'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Bug, X } from 'lucide-react'
import { brand } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

// Requires 'bug-reports' bucket in Supabase Storage
// Public: false, Max file size: 5MB, Images only

export default function BugReportWidget() {
  const [showModal, setShowModal] = useState(false)
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user)
    })
  }, [])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      setShowModal(false)
      setSuccess(false)
      setDescription('')
      setScreenshot(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [success])

  const handleClose = () => {
    if (loading) return
    setShowModal(false)
    setSuccess(false)
    setDescription('')
    setScreenshot(null)
  }

  const handleSubmit = async () => {
    const trimmedDescription = description.trim()
    if (!trimmedDescription) return

    setLoading(true)
    const supabase = createClient()
    let screenshotUrl: string | null = null

    try {
      if (screenshot) {
        const cleanFileName = screenshot.name
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9.\-_]/g, '')
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('bug-reports')
          .upload(`screenshots/${Date.now()}-${cleanFileName}`, screenshot)

        console.log('Upload error:', uploadError)
        console.log('Upload data:', uploadData)

        if (uploadError) {
          screenshotUrl = null
        } else if (uploadData?.path) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('bug-reports').getPublicUrl(uploadData.path)
          screenshotUrl = publicUrl
        }
      }

      const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

      const { error: insertError } = await supabase.from('bug_reports').insert({
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || null,
        page_url: pageUrl,
        description: trimmedDescription,
        screenshot_url: screenshotUrl,
      })
      if (insertError) throw insertError

      setSuccess(true)
    } catch {
      // keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!showModal ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg transition hover:bg-gray-700"
        >
          <Bug className="h-3 w-3" aria-hidden />
          Reportar problema
        </button>
      ) : null}

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bug-report-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="bug-report-title" className="text-lg font-bold text-gray-900">
                🐛 Reportar un problema
              </h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              <p className="mt-4 text-center text-sm text-gray-700">
                ✅ Reporte enviado. ¡Gracias por ayudarnos a mejorar MiParty!
              </p>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleSubmit()
                }}
              >
                <div>
                  <label htmlFor="bug-description" className="mb-1.5 block text-sm font-medium text-gray-900">
                    ¿Qué no está funcionando?
                  </label>
                  <textarea
                    id="bug-description"
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el problema con el mayor detalle posible..."
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="bug-screenshot" className="text-sm font-medium text-gray-900">
                      Captura de pantalla
                    </label>
                    <span className="text-xs text-gray-400">Opcional</span>
                  </div>
                  <input
                    id="bug-screenshot"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {screenshot ? (
                    <p className="mt-1 truncate text-xs text-gray-500">{screenshot.name}</p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={loading || !description.trim()}
                  className={`mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${brand.buttonPrimary}`}
                >
                  {loading ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
