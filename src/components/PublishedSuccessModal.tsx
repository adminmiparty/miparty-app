'use client'

import { Link2, ListChecks, Sparkles, X } from 'lucide-react'
import { brand } from '@/lib/brand'

type PublishedSuccessModalProps = {
  open: boolean
  variant?: 'paid' | 'free'
  onClose: () => void
  onShareInvitation: () => void
}

const BODY_COPY = {
  paid: 'Gracias por confiar en MiParty. Ya puedes compartir la invitación con tus invitados, recibir confirmaciones y tener todo bajo control desde este panel.',
  free: 'Tu primer evento en MiParty ya está publicado. Ya puedes compartir la invitación, recibir confirmaciones y tener todo bajo control desde este panel.',
} as const

const NEXT_STEPS = [
  { icon: Link2, text: 'Comparte el enlace de la invitación' },
  { icon: Sparkles, text: 'Recibe confirmaciones en tiempo real' },
  { icon: ListChecks, text: 'Consulta, copia o comparte la lista de invitados' },
] as const

export function PublishedSuccessModal({
  open,
  variant = 'paid',
  onClose,
  onShareInvitation,
}: PublishedSuccessModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="published-success-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        <h2 id="published-success-title" className="pr-8 text-xl font-bold text-gray-900">
          ¡Tu invitación está publicada! 🎉
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{BODY_COPY[variant]}</p>

        <ul className="mt-4 space-y-2.5">
          {NEXT_STEPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-gray-700">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-light)] text-[var(--brand-accent-dark)]"
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="pt-1 leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onShareInvitation}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${brand.buttonPrimary}`}
          >
            Compartir invitación
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${brand.buttonSecondary}`}
          >
            Ver panel del evento
          </button>
        </div>
      </div>
    </div>
  )
}
