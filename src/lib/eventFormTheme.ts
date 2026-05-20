import { brand } from '@/lib/brand'
import { type ThemeKey, themes } from '@/lib/themes'

/** User-selected invitation theme on create/edit forms; null = global MiParty brand chrome */
export type SelectedInvitationTheme = ThemeKey | null

export const DB_DEFAULT_INVITATION_THEME: ThemeKey = 'yellow'

export function isInvitationThemeKey(value: string | null | undefined): value is ThemeKey {
  return value != null && value in themes
}

export function parseInvitationThemeParam(raw: string | null | undefined): SelectedInvitationTheme {
  return isInvitationThemeKey(raw) ? raw : null
}

/** Persisted value when DB column is required but user did not pick a swatch */
export function themeForPersistence(selected: SelectedInvitationTheme): ThemeKey {
  return selected ?? DB_DEFAULT_INVITATION_THEME
}

const DRAFT_THEME_USER_PREFIX = 'u:'

/**
 * Draft rows: persist only when the user picked a swatch.
 * Uses a `u:` prefix so legacy auto-`yellow` values (saved without a pick) stay unset on resume.
 */
export function themeToDraftStorage(
  selected: SelectedInvitationTheme,
  userPicked: boolean
): string | null {
  if (!userPicked || !selected) return null
  return `${DRAFT_THEME_USER_PREFIX}${selected}`
}

/** Restore theme from a draft row (handles `u:yellow` etc.; bare `yellow` is treated as unset). */
export function themeFromDraftStorage(stored: string | null | undefined): SelectedInvitationTheme {
  if (!stored?.trim()) return null
  if (stored.startsWith(DRAFT_THEME_USER_PREFIX)) {
    const key = stored.slice(DRAFT_THEME_USER_PREFIX.length)
    return isInvitationThemeKey(key) ? key : null
  }
  // Legacy draft rows stored themeForPersistence() defaults without a user swatch.
  return null
}

/** Restore theme from a published/duplicate source row (normal theme keys). */
export function themeFromDraftRow(stored: string | null | undefined): SelectedInvitationTheme {
  return parseInvitationThemeParam(stored)
}

export function resolveThemeOrBrand<T>(
  map: Record<ThemeKey, T>,
  selected: SelectedInvitationTheme,
  brandFallback: T
): T {
  if (!selected) return brandFallback
  return map[selected] ?? map[DB_DEFAULT_INVITATION_THEME]
}

/** Brand chrome for event create/edit before a theme swatch is chosen */
export const eventFormBrandUi = {
  pageMainClass: brand.pageBg,
  submitButton: brand.formSubmit,
  progressAccent: brand.progressFill,
  progressTrack: brand.progressTrack,
  progressCardBorder: 'border-[var(--brand-border-light)]',
  inputFocus: brand.inputFocus,
  inputFocusRing: brand.inputFocus,
  inputFocusClass: `focus:ring-2 ${brand.inputFocus}`,
  sectionCard:
    'border-[var(--brand-border)] hover:border-[var(--brand-border-medium)] hover:bg-[var(--brand-primary-light)]',
  accentText: brand.textBrandDark,
  openSection: brand.borderLight,
  calendarHover: 'hover:bg-[var(--brand-primary-light)]',
  mipartyText: brand.textBrand,
  addOptionButton: brand.buttonOutline,
  calendarSelected: 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]',
  previewCard: 'bg-[var(--brand-primary-light)] border-[var(--brand-border-light)]',
  previewButton: brand.buttonPrimary,
  previewSelection: `${brand.textBrand} focus:ring-[var(--brand-focus)]`,
  zoomSlider: {
    thumbClass:
      '[&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-moz-range-thumb]:bg-[var(--brand-primary)]',
    fillColor: 'var(--brand-primary)',
  },
} as const

export function eventFormPageMainClass(
  selected: SelectedInvitationTheme,
  pageBgMap: Record<string, string>
): string {
  if (!selected) {
    return `min-h-screen ${eventFormBrandUi.pageMainClass}`
  }
  const gradient = pageBgMap[selected] ?? pageBgMap[DB_DEFAULT_INVITATION_THEME]
  return `min-h-screen bg-gradient-to-b ${gradient}`
}

export function eventFormSubmitButtonClass(
  selected: SelectedInvitationTheme,
  buttonMap: Record<string, string>
): string {
  if (!selected) {
    return eventFormBrandUi.submitButton
  }
  return `w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonMap[selected] ?? buttonMap[DB_DEFAULT_INVITATION_THEME]}`
}

export function sharePageThemeFromUrl(raw: string | null | undefined): ThemeKey | null {
  return parseInvitationThemeParam(raw)
}
