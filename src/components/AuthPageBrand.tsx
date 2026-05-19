import { brand } from '@/lib/brand'

export default function AuthPageBrand() {
  return (
    <div className="w-full text-center">
      <p className="text-3xl sm:text-4xl" aria-hidden="true">
        🎉
      </p>
      <h1 className={`mt-2 text-2xl font-bold sm:text-3xl ${brand.navBrand}`}>MiParty</h1>
      <p className="mt-1 text-sm text-[var(--brand-text-secondary)] sm:text-base">
        Organiza fiestas sin el caos
      </p>
    </div>
  )
}
