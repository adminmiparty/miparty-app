const SPANISH_MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const SPANISH_WEEKDAYS_LONG = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function parseIsoDateParts(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** e.g. "10 de mayo de 2026" — event cards (full month, clearly Spanish) */
export function formatEventDayMonthShort(isoDate: string) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const monthName = SPANISH_MONTHS_LONG[parts.month - 1] ?? ''
  return `${parts.day} de ${monthName} de ${parts.year}`
}

/** e.g. "10 de mayo de 2026" */
export function formatSpanishDateMedium(isoDate: string) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const monthName = SPANISH_MONTHS_LONG[parts.month - 1] ?? ''
  return capitalizeFirst(`${parts.day} de ${monthName} de ${parts.year}`)
}

/** e.g. "Sábado, 10 de mayo de 2026" */
export function formatSpanishFullDate(isoDate: string) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const weekday = SPANISH_WEEKDAYS_LONG[date.getDay()] ?? ''
  const monthName = SPANISH_MONTHS_LONG[parts.month - 1] ?? ''
  return capitalizeFirst(`${weekday}, ${parts.day} de ${monthName} de ${parts.year}`)
}

/** e.g. "Viernes, 9 de mayo" */
export function formatSpanishWeekdayDayMonth(isoDate: string) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const weekday = SPANISH_WEEKDAYS_LONG[date.getDay()] ?? ''
  const monthName = SPANISH_MONTHS_LONG[parts.month - 1] ?? ''
  return capitalizeFirst(`${weekday}, ${parts.day} de ${monthName}`)
}

/** e.g. "Viernes, 9 de mayo de 2026" — RSVP deadline with year */
export function formatSpanishWeekdayDayMonthYear(isoDate: string) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const weekday = SPANISH_WEEKDAYS_LONG[date.getDay()] ?? ''
  const monthName = SPANISH_MONTHS_LONG[parts.month - 1] ?? ''
  return capitalizeFirst(`${weekday}, ${parts.day} de ${monthName} de ${parts.year}`)
}
