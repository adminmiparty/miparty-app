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

/** Draft rows: only persist a theme when the user picked a swatch (null otherwise). */
export function themeForDraftPersistence(selected: SelectedInvitationTheme): string | null {
  return selected
}

/** Restore theme from a draft row; returns null when unset or not a known swatch key. */
export function themeFromDraftRow(
  stored: string | null | undefined,
  options?: { treatLegacyDefaultYellowAsUnset?: boolean }
): SelectedInvitationTheme {
  const parsed = parseInvitationThemeParam(stored)
  if (!parsed) return null
  if (
    options?.treatLegacyDefaultYellowAsUnset &&
    parsed === DB_DEFAULT_INVITATION_THEME
  ) {
    return null
  }
  return parsed
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
