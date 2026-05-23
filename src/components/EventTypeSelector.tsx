'use client'

import { EVENT_TYPE_OPTIONS, type EventType } from '@/lib/eventType'

type EventTypeSelectorProps = {
  value: EventType
  onChange: (value: EventType) => void
  selectedRingClass?: string
}

export function EventTypeSelector({
  value,
  onChange,
  selectedRingClass = 'ring-[var(--brand-focus)]',
}: EventTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">¿Qué quieres celebrar?</h2>
      <div className="grid grid-cols-2 gap-2">
        {EVENT_TYPE_OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition ${
                selected
                  ? `border-[var(--brand-border-accent)] bg-[var(--brand-primary-light)] text-gray-900 shadow-sm ring-2 ring-offset-1 ${selectedRingClass}`
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>
                {option.emoji}
              </span>
              <span className="text-xs font-medium leading-snug sm:text-sm">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
