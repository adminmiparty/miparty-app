import { EVENT_STATUS_ACTIVE } from '@/lib/eventLifecycle'

export type OrganizerBillingConfig = {
  freeOrganizedEventsEnabled: boolean
  freeOrganizedEventsLimit: number
  priceEur: number
  priceLabel: string
  priceCents: number
  stripeProductName: string
}

function parsePriceEur(raw: string | undefined): number {
  const normalized = (raw ?? '1.99').replace(',', '.').trim()
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) && value > 0 ? value : 1.99
}

function formatPriceLabel(eur: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(eur)
}

/** Server + client (via NEXT_PUBLIC_* mirrors). */
export function getOrganizerBillingConfig(): OrganizerBillingConfig {
  const freeOrganizedEventsEnabled =
    process.env.NEXT_PUBLIC_FREE_ORGANIZED_EVENTS_ENABLED === 'true'

  const limitRaw =
    process.env.FREE_ORGANIZED_EVENTS_LIMIT ??
    process.env.NEXT_PUBLIC_FREE_ORGANIZED_EVENTS_LIMIT ??
    '1'
  const parsedLimit = Number.parseInt(limitRaw, 10)
  const freeOrganizedEventsLimit =
    Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 1

  const priceEur = parsePriceEur(
    process.env.NEXT_PUBLIC_EVENT_PRICE_EUR ?? process.env.EVENT_PRICE_EUR
  )

  return {
    freeOrganizedEventsEnabled,
    freeOrganizedEventsLimit,
    priceEur,
    priceLabel: formatPriceLabel(priceEur),
    priceCents: Math.round(priceEur * 100),
    stripeProductName: 'MiParty Evento',
  }
}

export type PublishBillingDecision = {
  requiresPayment: boolean
  qualifiesForFree: boolean
  activeOrganizedCount: number
  message: string
}

/**
 * Whether this publish can proceed without Stripe.
 * Only counts existing **active** organized events (drafts excluded).
 */
export function decidePublishBilling(
  activeOrganizedCount: number,
  config: OrganizerBillingConfig = getOrganizerBillingConfig()
): PublishBillingDecision {
  const qualifiesForFree =
    config.freeOrganizedEventsEnabled &&
    activeOrganizedCount < config.freeOrganizedEventsLimit

  if (qualifiesForFree) {
    return {
      requiresPayment: false,
      qualifiesForFree: true,
      activeOrganizedCount,
      message: 'Tu primer evento es gratis',
    }
  }

  if (config.freeOrganizedEventsEnabled) {
    return {
      requiresPayment: true,
      qualifiesForFree: false,
      activeOrganizedCount,
      message: `Para publicar este evento, realiza el pago de ${config.priceLabel}.`,
    }
  }

  return {
    requiresPayment: true,
    qualifiesForFree: false,
    activeOrganizedCount,
    message: `Para publicar tu evento, realiza el pago de ${config.priceLabel}.`,
  }
}

export const ACTIVE_EVENT_STATUS = EVENT_STATUS_ACTIVE
