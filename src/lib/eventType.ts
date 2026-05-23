export const EVENT_TYPE_VALUES = [
  'cumpleanos',
  'comunion',
  'bautizo',
  'reunion_familiar',
  'reunion_amigos',
  'graduacion',
  'otro',
] as const

export type EventType = (typeof EVENT_TYPE_VALUES)[number]

export type EventTypeOption = {
  value: EventType
  emoji: string
  label: string
}

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: 'cumpleanos', emoji: '🎂', label: 'Cumpleaños' },
  { value: 'comunion', emoji: '✝️', label: 'Primera Comunión' },
  { value: 'bautizo', emoji: '👶', label: 'Bautizo' },
  { value: 'reunion_familiar', emoji: '🍽️', label: 'Reunión familiar' },
  { value: 'reunion_amigos', emoji: '🎉', label: 'Reunión con amigos' },
  { value: 'graduacion', emoji: '🎓', label: 'Graduación' },
  { value: 'otro', emoji: '✨', label: 'Otro' },
]

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPE_VALUES)

export function normalizeEventType(value: string | null | undefined): EventType {
  if (value && EVENT_TYPE_SET.has(value)) {
    return value as EventType
  }
  return 'cumpleanos'
}

export function getEventPersonHeading(eventType: EventType): string {
  switch (eventType) {
    case 'cumpleanos':
      return '¿Quién celebra el cumple?'
    case 'comunion':
      return '¿Quién celebra la comunión?'
    case 'bautizo':
      return '¿Quién será protagonista del bautizo?'
    case 'reunion_familiar':
      return '¿Quién organiza la reunión?'
    case 'reunion_amigos':
      return '¿Quién organiza el encuentro?'
    case 'graduacion':
      return '¿Quién celebra la graduación?'
    case 'otro':
      return '¿Para quién es el evento?'
    default:
      return '¿Para quién es el evento?'
  }
}

export function eventTypeAutoGeneratesTitle(eventType: EventType): boolean {
  return (
    eventType === 'cumpleanos' ||
    eventType === 'comunion' ||
    eventType === 'bautizo' ||
    eventType === 'graduacion'
  )
}

export function buildAutoEventTitle(eventType: EventType, childName: string): string | null {
  if (!eventTypeAutoGeneratesTitle(eventType)) {
    return null
  }
  const firstName = childName.trim().split(/\s+/)[0]
  if (!firstName) {
    return null
  }
  switch (eventType) {
    case 'cumpleanos':
      return `Cumple de ${firstName}`
    case 'comunion':
      return `Comunión de ${firstName}`
    case 'bautizo':
      return `Bautizo de ${firstName}`
    case 'graduacion':
      return `Graduación de ${firstName}`
    default:
      return null
  }
}
