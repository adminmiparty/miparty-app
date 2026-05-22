'use client'

import { formatEventDayMonthShort } from '@/lib/dates'

export type DraftEventListItem = {
  id: string
  title: string
  child_name: string
  event_date: string
  start_time: string | null
}

function formatTimeShort(time: string | null) {
  if (!time || String(time).trim() === '') return null
  return String(time).slice(0, 5)
}

type DraftEventListRowProps = {
  draft: DraftEventListItem
  onContinue: () => void
  onDelete: () => void
}

/** Full-width draft row aligned with dashboard event list cards. */
export default function DraftEventListRow({ draft, onContinue, onDelete }: DraftEventListRowProps) {
  const dateShort = formatEventDayMonthShort(draft.event_date)
  const timeLabel = formatTimeShort(draft.start_time)
  const dateLine = (
    <>
      📅 {dateShort}
      {timeLabel ? ` · ${timeLabel}` : ''}
    </>
  )

  return (
    <li className="w-full">
      <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-100 border-l-4 border-l-gray-300 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-3">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-base leading-none sm:h-10 sm:w-10 sm:text-lg"
            aria-hidden
          >
            📝
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:min-w-0 sm:gap-2">
              <span className="inline-block shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                Borrador
              </span>
              <p className="min-w-0 text-sm font-semibold leading-snug text-gray-900 sm:flex-1 sm:truncate">
                {draft.title}
              </p>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500">{draft.child_name}</p>
            <p className="mt-1 text-xs text-gray-500 sm:hidden">{dateLine}</p>
            <p className="mt-1 hidden text-xs text-gray-500 sm:block">{dateLine}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onDelete}
            className="order-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-700 sm:order-2"
            aria-label="Eliminar borrador"
          >
            🗑️
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="order-2 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 sm:order-1 sm:flex-none sm:whitespace-nowrap"
          >
            Continuar editando
          </button>
        </div>
      </div>
    </li>
  )
}
