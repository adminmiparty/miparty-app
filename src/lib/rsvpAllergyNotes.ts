/** Standalone replies meaning "no allergies" — stored and shown as empty. */
const EMPTY_ALLERGY_RESPONSES = new Set(['no', 'ninguna'])

/**
 * Trims RSVP allergy notes and maps standalone "No" / "Ninguna" (any case) to null.
 */
export function normalizeRsvpAllergyNotesForStorage(
  notes: string | null | undefined
): string | null {
  const trimmed = (notes ?? '').trim()
  if (!trimmed) {
    return null
  }
  if (EMPTY_ALLERGY_RESPONSES.has(trimmed.toLowerCase())) {
    return null
  }
  return trimmed
}

export function hasMeaningfulRsvpAllergyNotes(notes: string | null | undefined): boolean {
  return normalizeRsvpAllergyNotesForStorage(notes) !== null
}
