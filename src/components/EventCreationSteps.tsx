type EventCreationStepsProps = {
  /** 1 = create form, 2 = share / review */
  step: 1 | 2
  progressAccentClass: string
  progressTrackClass: string
  progressCardBorderClass: string
  /** Left label on step 1 progress card (default: new event). */
  step1Label?: string
  className?: string
}

/** Shared “Paso 1 de 2” progress card for create + share flows. */
export default function EventCreationSteps({
  step,
  progressAccentClass,
  progressTrackClass,
  progressCardBorderClass,
  step1Label = 'Crear evento',
  className = 'mb-4',
}: EventCreationStepsProps) {
  const fillWidth = step === 1 ? 'w-1/2' : 'w-full'

  return (
    <div
      className={`rounded-xl border ${progressCardBorderClass} bg-white/80 p-3 ${className}`}
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
