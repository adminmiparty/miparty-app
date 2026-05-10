// MiParty brand design tokens
// Import this file on all app-level pages (not event-themed pages)
// To retheme the entire app, update values here only
// Event-level themes are in src/lib/themes.ts

export const brand = {
  // Primary brand color
  primary: 'yellow' as const,

  // Backgrounds
  pageBg: 'bg-gradient-to-b from-yellow-50 to-white',
  cardBg: 'bg-white',

  // Buttons
  buttonPrimary: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
  buttonSecondary: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-800',
  buttonOutline: 'border border-yellow-400 text-yellow-600 hover:bg-yellow-50',

  // Text
  textBrand: 'text-yellow-500',
  textBrandDark: 'text-yellow-600',
  textBrandHover: 'hover:text-yellow-700',

  // Borders
  borderBrand: 'border-yellow-400',
  borderLight: 'border-yellow-100',
  borderMedium: 'border-yellow-200',

  // Navigation bar (top sticky bar)
  navBg: 'bg-white',
  navBorder: 'border-b border-gray-200',
  navText: 'text-gray-600',
  navTextHover: 'hover:text-gray-900',
  navBrand: 'text-yellow-500 font-bold',

  // Tabs
  tabActive: 'border-b-2 border-yellow-400 text-yellow-700 font-medium',
  tabInactive: 'text-gray-500 hover:text-gray-700',

  // Progress bar
  progressFill: 'bg-yellow-400',
  progressTrack: 'bg-yellow-100',

  // Badges
  badgeProximo: 'bg-green-100 text-green-700',
  badgePasado: 'bg-gray-100 text-gray-500',
  badgeDraft: 'bg-yellow-100 text-yellow-700',

  // Focus rings (for inputs on brand pages)
  inputFocus: 'ring-yellow-400 focus:border-yellow-400',

  // Accents
  accentText: 'text-yellow-600',
  accentBg: 'bg-yellow-50',
  accentBorder: 'border-yellow-200',
} as const

export type BrandKey = keyof typeof brand
