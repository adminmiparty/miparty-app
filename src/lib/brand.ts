// MiParty app chrome — Tailwind classes backed by CSS variables in src/app/globals.css
// To retheme the app, update :root in globals.css only.
// Per-event invitation themes: src/lib/themes.ts (separate palette per event)

export const brand = {
  primary: 'coral' as const,

  pageBg: 'bg-gradient-to-b from-[var(--brand-surface-top)] to-[var(--brand-surface-bottom)]',
  cardBg: 'bg-[var(--brand-card)]',

  buttonPrimary:
    'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-on-primary)]',
  dashboardPrimaryPill:
    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-sm transition hover:bg-[var(--brand-primary-hover)]',
  buttonSecondary:
    'bg-white border border-[var(--brand-border)] hover:bg-[var(--brand-primary-light)] text-[var(--brand-text)]',
  buttonOutline:
    'border border-[var(--brand-border-accent)] text-[var(--brand-accent-dark)] hover:bg-[var(--brand-primary-light)]',

  textBrand: 'text-[var(--brand-accent)]',
  textBrandDark: 'text-[var(--brand-accent-dark)]',
  textBrandHover: 'hover:text-[var(--brand-accent-dark)]',

  borderBrand: 'border-[var(--brand-border-accent)]',
  borderLight: 'border-[var(--brand-border-light)]',
  borderMedium: 'border-[var(--brand-border-medium)]',

  navBg: 'bg-white',
  /** Sticky app header (dashboard, landing) */
  navSticky:
    'sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-[var(--brand-surface-nav)] shadow-sm backdrop-blur-sm',
  navBorder: 'border-b border-[var(--brand-border)]',
  navText: 'text-[var(--brand-text-muted)]',
  navTextHover: 'hover:text-[var(--brand-text)]',
  navBrand: 'text-[var(--brand-accent)] font-bold',

  tabActive:
    'border-b-2 border-[var(--brand-border-accent)] text-[var(--brand-accent-dark)] font-medium',
  tabInactive: 'text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)]',

  progressFill: 'bg-[var(--brand-primary)]',
  progressTrack: 'bg-[var(--brand-primary-muted)]',

  badgeProximo: 'bg-green-100 text-green-700',
  badgePasado: 'bg-gray-100 text-gray-500',
  badgeDraft: 'bg-[var(--brand-primary-muted)] text-[var(--brand-accent-dark)]',

  inputFocus: 'ring-[var(--brand-focus)] focus:border-[var(--brand-focus)]',

  /** Standard text/email inputs (auth, profile, modals) */
  formInput:
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ring-[var(--brand-focus)] focus:border-[var(--brand-focus)]',

  /** Primary submit on forms (rounded-lg, not pill) */
  formSubmit:
    'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-on-primary)]',

  linkBrand: 'font-semibold text-[var(--brand-accent)] hover:text-[var(--brand-accent-dark)]',

  togglePillActive: 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]',

  avatarBrand: 'bg-[var(--brand-primary-muted)] text-[var(--brand-accent-dark)]',

  cardFocusRing: 'focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/50',
  cardActiveRing: 'ring-2 ring-[var(--brand-primary)]/40',

  modalActionPrimary:
    'flex w-full items-center gap-3 rounded-xl bg-[var(--brand-primary-light)] px-4 py-3 transition hover:bg-[var(--brand-primary-muted)]',
  modalActionPrimaryIcon:
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-muted)] text-lg',

  accentText: 'text-[var(--brand-accent-dark)]',
  accentBg: 'bg-[var(--brand-primary-light)]',
  accentBorder: 'border-[var(--brand-border-medium)]',

  landingPrimaryPill:
    'inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-primary)] shadow-sm transition hover:bg-[var(--brand-primary-hover)]',

  landingCtaPrimary:
    'inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-7 py-3 text-sm font-semibold text-[var(--brand-on-primary)] shadow-sm transition hover:bg-[var(--brand-primary-hover)]',

  landingCtaSecondary:
    'inline-flex items-center justify-center rounded-full border border-[var(--brand-border)] bg-white px-7 py-3 text-sm font-medium text-[var(--brand-text)] transition hover:bg-[var(--brand-primary-light)]',
} as const

export type BrandKey = keyof typeof brand
