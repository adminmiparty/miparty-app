import Link from 'next/link'
import type { ReactNode } from 'react'
import { brand } from '@/lib/brand'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-[var(--brand-text)] sm:text-lg">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}

export function LegalContact() {
  return (
    <p className="text-[var(--brand-text-secondary)]">
      ¿Preguntas? Escríbenos a{' '}
      <a
        href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        className={`font-medium ${brand.textBrand} underline-offset-2 hover:underline`}
      >
        {LEGAL_CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}

export default function LegalPageShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main
      className={`min-h-screen ${brand.pageBg} pb-[calc(3rem+env(safe-area-inset-bottom,0px))]`}
    >
      <header className={brand.navSticky}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className={`text-xl font-bold ${brand.navBrand}`}>
            MiParty
          </Link>
          <Link
            href="/"
            className={`text-sm font-medium text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-text)]`}
          >
            Inicio
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className={`text-sm font-medium ${brand.textBrand}`}>MiParty</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--brand-text)] sm:text-3xl">
          {title}
        </h1>
        <div className="mt-8 space-y-8 border-t border-[var(--brand-border)] pt-8 text-sm leading-relaxed text-[var(--brand-text-secondary)] sm:text-base">
          {children}
        </div>
      </article>

      <footer className="border-t border-[var(--brand-border)] py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 text-center text-sm sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link
              href="/privacy"
              className="font-medium text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-accent-dark)]"
            >
              Política de privacidad
            </Link>
            <span className="text-[var(--brand-text-muted)]" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="font-medium text-[var(--brand-text-secondary)] transition hover:text-[var(--brand-accent-dark)]"
            >
              Términos del servicio
            </Link>
          </div>
          <p className="text-xs text-[var(--brand-text-muted)]">
            © {new Date().getFullYear()} MiParty
          </p>
        </div>
      </footer>
    </main>
  )
}

export { LegalSection }
