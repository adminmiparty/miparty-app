import { mirrorMetaConversionToServer } from '@/lib/meta-conversions-mirror'
import type { MetaPixelEventName } from '@/lib/meta-conversions-api'

function eventSourceUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

function sendPixelEvent(
  eventName: MetaPixelEventName,
  options?: {
    contentName?: string
    value?: number
    currency?: string
    eventId?: string
  }
): void {
  mirrorMetaConversionToServer({
    eventName,
    eventSourceUrl: eventSourceUrl(),
    eventId: options?.eventId,
    contentName: options?.contentName,
    value: options?.value,
    currency: options?.currency,
  })
}

export function trackViewContent(contentName?: string): void {
  sendPixelEvent('ViewContent', { contentName })
}

export function trackLead(contentName: string): void {
  sendPixelEvent('Lead', { contentName })
}

export function trackCompleteRegistration(eventId?: string): void {
  sendPixelEvent('CompleteRegistration', { eventId })
}

export function trackSchedule(eventId?: string): void {
  sendPixelEvent('Schedule', { eventId })
}

export function trackInitiateCheckout(eventId?: string): void {
  sendPixelEvent('InitiateCheckout', { eventId })
}

export function trackPurchase(value: number, currency: string, eventId?: string): void {
  sendPixelEvent('Purchase', { value, currency, eventId })
}

export type RsvpAttendanceStatus = 'confirmed' | 'declined' | 'maybe'

const RSVP_ATTENDANCE_LEAD: Record<RsvpAttendanceStatus, string> = {
  confirmed: 'rsvp_confirmed',
  declined: 'rsvp_declined',
  maybe: 'rsvp_maybe',
}

export function trackRsvpAttendanceLead(attendance: RsvpAttendanceStatus): void {
  trackLead(RSVP_ATTENDANCE_LEAD[attendance])
}
