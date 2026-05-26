type TikTokEventName =
  | 'ViewContent'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Schedule'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'ClickButton'
  | 'SubmitForm'

type TikTokContentItem = {
  content_id: string
}

type TikTokEventPropValue = string | number | boolean | TikTokContentItem[]

type TikTokEventProps = {
  contents?: TikTokContentItem[]
  [key: string]: TikTokEventPropValue | undefined
}

interface TikTokPixel {
  page: () => void
  track: (event: TikTokEventName, properties?: TikTokEventProps) => void
}

declare global {
  interface Window {
    ttq?: TikTokPixel
  }
}

function hasTtq(): boolean {
  return typeof window !== 'undefined' && typeof window.ttq?.track === 'function'
}

function track(event: TikTokEventName, props?: TikTokEventProps): void {
  if (!hasTtq()) return
  window.ttq!.track(event, props)
}

export function trackViewContent(contentName?: string): void {
  const trimmed = contentName?.trim()
  const contentId = trimmed && trimmed.length > 0 ? trimmed : 'miparty'

  track('ViewContent', {
    ...(trimmed ? { content_name: trimmed } : {}),
    contents: [{ content_id: contentId }],
  })
}

export function trackLead(contentName: string): void {
  const trimmed = contentName.trim()
  if (!trimmed) return
  track('Lead', { content_name: trimmed })
}

export function trackCompleteRegistration(): void {
  track('CompleteRegistration')
}

export function trackSchedule(): void {
  track('Schedule')
}

export function trackInitiateCheckout(): void {
  track('InitiateCheckout')
}

export function trackPurchase(value: number, currency: string): void {
  const trimmedCurrency = currency.trim()
  if (!trimmedCurrency) return
  track('Purchase', { value, currency: trimmedCurrency })
}

export function trackClickButton(contentName: string): void {
  const trimmed = contentName.trim()
  if (!trimmed) return
  track('ClickButton', { content_name: trimmed })
}

export function trackSubmitForm(contentName: string): void {
  const trimmed = contentName.trim()
  if (!trimmed) return
  track('SubmitForm', { content_name: trimmed })
}

