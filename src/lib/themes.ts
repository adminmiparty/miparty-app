/** Invitation / RSVP page color sets. `yellow` matches app tokens in globals.css (`--brand-*`). */
export type ThemeKey = 'yellow' | 'pink' | 'blue' | 'green' | 'purple'

export const themes: Record<
  ThemeKey,
  {
    label: string
    bg: string
    pageBg: string
    button: string
    buttonHover: string
    accent: string
    border: string
    swatch: string
  }
> = {
  yellow: {
    label: 'Amarillo',
    bg: 'bg-yellow-50',
    pageBg: 'from-yellow-50 to-white',
    button: 'bg-yellow-400',
    buttonHover: 'hover:bg-yellow-500',
    accent: 'ring-yellow-400',
    border: 'border-yellow-400',
    swatch: 'bg-yellow-400',
  },
  pink: {
    label: 'Rosa',
    bg: 'bg-pink-50',
    pageBg: 'from-pink-50 to-white',
    button: 'bg-pink-400',
    buttonHover: 'hover:bg-pink-500',
    accent: 'ring-pink-400',
    border: 'border-pink-400',
    swatch: 'bg-pink-400',
  },
  blue: {
    label: 'Azul',
    bg: 'bg-blue-50',
    pageBg: 'from-blue-50 to-white',
    button: 'bg-blue-400',
    buttonHover: 'hover:bg-blue-500',
    accent: 'ring-blue-400',
    border: 'border-blue-400',
    swatch: 'bg-blue-400',
  },
  green: {
    label: 'Verde',
    bg: 'bg-green-50',
    pageBg: 'from-green-50 to-white',
    button: 'bg-green-400',
    buttonHover: 'hover:bg-green-500',
    accent: 'ring-green-400',
    border: 'border-green-400',
    swatch: 'bg-green-400',
  },
  purple: {
    label: 'Lila',
    bg: 'bg-purple-50',
    pageBg: 'from-purple-50 to-white',
    button: 'bg-purple-400',
    buttonHover: 'hover:bg-purple-500',
    accent: 'ring-purple-400',
    border: 'border-purple-400',
    swatch: 'bg-purple-400',
  },
}

export function getTheme(key?: string | null): typeof themes.yellow {
  return themes[(key as ThemeKey) ?? 'yellow'] ?? themes.yellow
}
