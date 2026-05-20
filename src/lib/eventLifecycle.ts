/** Supabase `events.status` — lifecycle only (not RSVP, not Próximo/Hoy/Pasado). */
export const EVENT_STATUS_DRAFT = 'draft' as const
export const EVENT_STATUS_ACTIVE = 'active' as const

export type EventLifecycleStatus = typeof EVENT_STATUS_DRAFT | typeof EVENT_STATUS_ACTIVE

export function isActiveEventStatus(status: string | null | undefined): boolean {
  return (status ?? EVENT_STATUS_ACTIVE) === EVENT_STATUS_ACTIVE
}
