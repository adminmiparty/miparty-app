type FbqCommand = 'track' | 'trackCustom' | 'init'

type FbqParams = Record<string, string | number | boolean>

interface FbqFunction {
  (...args: [FbqCommand, string, FbqParams?]): void
  (...args: [FbqCommand, string]): void
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[]
  loaded?: boolean
  version?: string
  push?: FbqFunction
}

declare global {
  interface Window {
    fbq?: FbqFunction
  }
}

function hasFbq(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function'
}

function trackStandard(event: string, params?: FbqParams): void {
  if (!hasFbq()) return
  if (params) {
    window.fbq!('track', event, params)
  } else {
    window.fbq!('track', event)
  }
}

export function trackViewContent(contentName?: string): void {
  if (!hasFbq()) return
  if (contentName) {
    window.fbq!('track', 'ViewContent', { content_name: contentName })
  } else {
    window.fbq!('track', 'ViewContent')
  }
}

export function trackLead(contentName: string): void {
  if (!hasFbq()) return
  window.fbq!('track', 'Lead', { content_name: contentName })
}

export function trackCompleteRegistration(): void {
  trackStandard('CompleteRegistration')
}

export function trackSchedule(): void {
  trackStandard('Schedule')
}

export function trackInitiateCheckout(): void {
  trackStandard('InitiateCheckout')
}

export function trackPurchase(value: number, currency: string): void {
  if (!hasFbq()) return
  window.fbq!('track', 'Purchase', { value, currency })
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
