export type PersonRelation = 'hijo' | 'familiar' | 'amigo'

export const PERSON_RELATION_OPTIONS: ReadonlyArray<{
  value: PersonRelation
  label: string
  emoji: string
}> = [
  { value: 'hijo', label: 'Hijo/a', emoji: '👦' },
  { value: 'familiar', label: 'Familiar', emoji: '👨‍👩‍👧' },
  { value: 'amigo', label: 'Amigo/a', emoji: '😊' },
] as const

export function isPersonRelation(value: string | null | undefined): value is PersonRelation {
  return value === 'hijo' || value === 'familiar' || value === 'amigo'
}

export function normalizePersonRelation(value: string | null | undefined): PersonRelation {
  return isPersonRelation(value) ? value : 'hijo'
}

export function relationMeta(relation: PersonRelation) {
  return PERSON_RELATION_OPTIONS.find((o) => o.value === relation) ?? PERSON_RELATION_OPTIONS[0]
}

function computeAgeYears(birthIso: string, today: Date): number {
  const [y, mo, d] = birthIso.split('-').map((value) => Number.parseInt(value, 10))
  const birth = new Date(y, mo - 1, d)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

/** Card subtitle, e.g. "👦 Hijo · 6 años" or "😊 Amigo/a" */
export function formatPersonRelationLine(
  relation: PersonRelation,
  birthDate: string | null | undefined,
  today: Date = new Date()
): string {
  const meta = relationMeta(relation)
  const birth = birthDate?.trim()
  if (birth && /^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    const age = computeAgeYears(birth, today)
    return `${meta.emoji} ${meta.label} · ${age} años`
  }
  return `${meta.emoji} ${meta.label}`
}
