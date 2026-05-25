type EventCreationStepsProps = {
  /** 1 = create form, 2 = share / review */
  step: 1 | 2
  progressAccentClass: string
  progressTrackClass: string
  progressCardBorderClass: string
  /** Left label on step 1 progress card (default: new event). */
  step1Label?: string
  /** `nav` = compact strip for the sticky AppNav bar. */
  variant?: 'card' | 'nav'
  className?: string
}

/** Shared “Paso 1 de 2” progress for create + share flows. */
export default function EventCreationSteps({
  step,
  progressAccentClass,
  progressTrackClass,
  progressCardBorderClass,
  step1Label = 'Crear evento',
  variant = 'card',
  className = '',
}: EventCreationStepsProps) {
  const fillWidth = step === 1 ? 'w-1/2' : 'w-full'

  if (variant === 'nav') {
    return (
      <div className={`min-w-0 w-full ${className}`} aria-label="Progreso de creación del evento">
        <div className="flex items-center justify-between gap-2 text-[10px] font-medium leading-tight text-gray-600">
          <span className="min-w-0 truncate">Paso 1 de 2 — {step1Label}</span>
          <span className="shrink-0">2: Compartir invitación</span>
        </div>
        <div className={`mt-0.5 h-1 w-full rounded-full ${progressTrackClass}`}>
          <div className={`h-1 ${fillWidth} rounded-full ${progressAccentClass}`} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`mb-4 rounded-xl border ${progressCardBorderClass} bg-white/80 p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-600">
        <span>Paso 1 de 2 — {step1Label}</span>
        <span>2: Compartir invitación</span>
      </div>
      <div className={`h-2 w-full rounded-full ${progressTrackClass}`}>
        <div className={`h-2 ${fillWidth} rounded-full ${progressAccentClass}`} />
      </div>
    </div>
  )
}
