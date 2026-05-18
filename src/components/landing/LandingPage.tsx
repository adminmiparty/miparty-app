import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { brand } from '@/lib/brand'

type FeatureItem = {
  emoji: string
  title: string
  description: string
  detail: ReactNode
}

const features: FeatureItem[] = [
  {
    emoji: '👨‍👩‍👧‍👦',
    title: 'Perfiles familiares',
    description: 'Hijos, alergias y fechas. Una vez y listo.',
    detail: (
      <div className="mt-3 flex items-center gap-2">
        {[
          { initial: 'S', name: 'Sofía' },
          { initial: 'M', name: 'Mateo' },
        ].map((child) => (
          <div key={child.name} className="flex items-center gap-1.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${brand.avatarBrand}`}>
              {child.initial}
            </span>
            <span className="text-[11px] text-gray-500">{child.name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    emoji: '🔗',
    title: 'Un solo enlace',
    description: 'Invitación lista para WhatsApp.',
    detail: (
      <p className="mt-3 inline-block rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700">
        miparty.app/e/sofia-7
      </p>
    ),
  },
  {
    emoji: '✅',
    title: 'Confirmaciones claras',
    description: 'Quién viene y quién no, en tu panel.',
    detail: (
      <p className="mt-3 text-[11px] text-gray-500">
        <span className="text-green-600">✓ 8 confirmados</span>
        {'  ·  '}
        <span className="text-amber-600">⏳ 2 pendientes</span>
      </p>
    ),
  },
  {
    emoji: '🔔',
    title: 'Menos persecución',
    description: 'Pendientes y menú, sin ir pregunta por pregunta.',
    detail: (
      <span className="mt-3 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-800">
        ✓ Lista para imprimir
      </span>
    ),
  },
]

const steps = [
  {
    number: '1',
    title: 'Crea tu familia',
    description: 'Añade hijos y alergias.',
    hint: (
      <span className="mt-2 inline-block rounded-full border border-gray-100 bg-white px-2.5 py-0.5 text-[11px] text-gray-500 shadow-[var(--shadow-card)]">
        Sofía · 6 años · 🌾 Sin gluten
      </span>
    ),
  },
  {
    number: '2',
    title: 'Comparte el enlace',
    description: 'Envíalo por WhatsApp.',
    hint: (
      <p className="mt-2 font-mono text-[11px] text-gray-500">miparty.app/e/sofia-7</p>
    ),
  },
  {
    number: '3',
    title: 'Mira las respuestas',
    description: 'Confirmaciones y menú al día.',
    hint: (
      <p className="mt-2 text-[11px]">
        <span className="text-green-600">✓ 8</span>
        {'  ·  '}
        <span className="text-amber-600">⏳ 2</span>
        {'  ·  '}
        <span className="text-red-500">❌ 1</span>
      </p>
    ),
  },
]

const plans = [
  {
    name: 'Un evento',
    price: 'Gratis',
    benefits: ['1 evento', 'Sin tarjeta'],
    highlight: false,
  },
  {
    name: 'Plan familia',
    price: '9 €',
    period: '/ mes',
    benefits: ['Eventos ilimitados', 'Perfiles y recordatorios'],
    highlight: true,
  },
  {
    name: 'De por vida',
    price: '79 €',
    benefits: ['Un solo pago', 'Toda la familia'],
    highlight: false,
  },
]

const previewCaptions = ['Panel', 'Invitación', 'Menú', 'WhatsApp'] as const

const allergyPills = [
  { label: '🌾 Sin gluten', className: brand.avatarBrand },
  { label: '🥛 Sin lácteos', className: 'bg-blue-100 text-blue-800' },
  { label: '🥜 Alergia frutos secos', className: 'bg-red-100 text-red-800' },
]

function PreviewDashboard() {
  return (
    <div className="card-soft overflow-hidden p-4">
      <p className="text-sm font-semibold text-gray-900">Hola, Laura 👋</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {['Sofía', 'Mateo'].map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-[var(--shadow-card)]"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${brand.avatarBrand}`}>
              {name[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900">{name}</p>
              <p className="text-[10px] text-gray-500">6 años</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-gray-100 border-l-4 border-l-[var(--brand-primary)] bg-white p-3 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold text-gray-900">Cumple 7 de Sofía</p>
        <p className="mt-1 text-[10px] font-medium text-green-600">8 confirmados</p>
      </div>
    </div>
  )
}

function PreviewRsvp() {
  return (
    <div className="card-soft overflow-hidden bg-gradient-to-b from-[var(--brand-surface-top)] to-white p-4 ring-2 ring-[var(--brand-primary)]">
      <p className={`text-center text-xs font-medium ${brand.textBrand}`}>Invitación</p>
      <p className="mt-1 text-center font-display text-lg font-semibold text-gray-900">Cumple 7 de Sofía</p>
      <p className="mt-0.5 text-center text-[10px] text-gray-500">18 mayo · 17:00</p>
      <div className="mt-3 space-y-1.5">
        <div className="rounded-lg bg-[var(--brand-primary)] py-2 text-center text-xs font-semibold text-[var(--brand-on-primary)]">
          ¡Voy! 🎉
        </div>
        <div className="rounded-lg border border-gray-200 bg-white py-2 text-center text-xs text-gray-500">
          No podré ir
        </div>
      </div>
    </div>
  )
}

function PreviewFoodSummary() {
  return (
    <div className="card-soft p-4">
      <p className="text-xs font-semibold text-gray-900">Menú</p>
      <ul className="mt-2 space-y-1.5 text-[11px] text-gray-500">
        <li className="flex justify-between gap-2">
          <span>Confirmados</span>
          <span className="font-medium text-gray-900">8 familias</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Sin gluten</span>
          <span className="font-medium text-amber-600">2</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Vegetariano</span>
          <span className="font-medium text-green-600">1</span>
        </li>
      </ul>
    </div>
  )
}

function PreviewWhatsApp() {
  return (
    <div className="card-soft bg-green-50 p-3 ring-1 ring-green-200">
      <div className="rounded-xl bg-white p-3 shadow-[var(--shadow-card)]">
        <div className="mt-2 max-w-[90%] rounded-lg rounded-tl-sm bg-[#dcf8c6] px-2.5 py-2 text-[11px] leading-snug text-gray-800">
          Invitación del cumple 🎂{' '}
          <span className="text-blue-600 underline">miparty.app/e/sofia-7</span>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className={`min-h-screen ${brand.pageBg}`}>
      <header className={`${brand.navSticky} z-40`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className={`text-xl font-bold ${brand.navBrand}`}>
            MiParty
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-600 sm:flex" aria-label="Principal">
            <a href="#producto" className="transition hover:text-gray-900">
              El producto
            </a>
            <a href="#como-funciona" className="transition hover:text-gray-900">
              Cómo funciona
            </a>
            <a href="#precios" className="transition hover:text-gray-900">
              Precios
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white/80 hover:text-gray-900 sm:inline-block"
            >
              Iniciar sesión
            </Link>
            <Link href="/registro" className={brand.landingPrimaryPill}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
          <div className="max-w-xl">
            <p className={`text-sm font-medium ${brand.textBrandDark}`}>Cumpleaños sin caos</p>
            <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.15] tracking-tight text-gray-900 sm:text-[2.65rem] lg:text-[3.5rem]">
              Todos tus cumpleaños en un solo lugar.
            </h1>
            <p className="mt-5 max-w-md text-base leading-snug text-gray-600 sm:text-lg">
              Un enlace para invitar. Confirmaciones y alergias en tu panel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/registro" className={brand.landingCtaPrimary}>
                Crear mi primer evento
              </Link>
              <a href="#como-funciona" className={brand.landingCtaSecondary}>
                Ver cómo funciona
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
              <Image
                src="https://images.unsplash.com/photo-1530103862673-de7c9ed5a4ef?auto=format&fit=crop&w=1200&q=80"
                alt="Familia celebrando un cumpleaños infantil"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
            </div>

            <div
              className="absolute right-2 top-3 z-10 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] shadow-[var(--shadow-card)] sm:right-4 sm:top-4"
              aria-hidden
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
              <span className="font-medium text-gray-900">8 confirmadas ✓</span>
            </div>

            <div
              className="absolute bottom-16 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5 sm:bottom-20 sm:left-3 lg:bottom-24"
              aria-hidden
            >
              {allergyPills.map((pill) => (
                <span
                  key={pill.label}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.className}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>

            <div
              className="absolute -bottom-3 left-3 right-3 z-10 sm:-bottom-4 sm:left-4 sm:right-auto sm:w-[min(100%,17.5rem)] lg:-bottom-5 lg:left-5"
              aria-hidden
            >
              <div className="card-soft px-5 py-3">
                <p className="text-[15px] font-semibold text-gray-900">Cumple 7 de Sofía</p>
                <p className="mt-1 text-[12px] font-medium text-green-600">✓ 8 · ⏳ 2</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-100 bg-white/60 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Lo esencial
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {features.map((feature) => (
                <article key={feature.title} className="card-soft flex flex-col px-5 py-5">
                  <span className="text-xl" aria-hidden>
                    {feature.emoji}
                  </span>
                  <h3 className="mt-2.5 text-base font-semibold leading-snug text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600">
                    {feature.description}
                  </p>
                  {feature.detail}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section id="producto" className="scroll-mt-20 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              El producto
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {(
                [
                  { Preview: PreviewDashboard, offset: false },
                  { Preview: PreviewRsvp, offset: true },
                  { Preview: PreviewFoodSummary, offset: false },
                  { Preview: PreviewWhatsApp, offset: true },
                ] as const
              ).map(({ Preview, offset }, index) => (
                <div key={previewCaptions[index]} className={offset ? 'sm:-translate-y-3' : ''}>
                  <Preview />
                  <p className="mt-2 text-center text-xs font-medium text-gray-500">
                    {previewCaptions[index]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="como-funciona"
          className={`scroll-mt-20 border-t border-gray-100 py-10 sm:py-14 ${brand.pageBg}`}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Tres pasos
            </h2>
            <ol className="relative mt-8 grid gap-6 sm:mt-10 sm:grid-cols-3 sm:gap-4">
              <div
                className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-5 hidden h-px bg-gray-200 sm:block"
                aria-hidden
              />
              {steps.map((step) => (
                <li key={step.number} className="relative z-[1] text-center">
                  <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)] font-display text-lg font-bold text-[var(--brand-on-primary)]">
                    {step.number}
                  </span>
                  <h3 className="mt-2.5 text-base font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.description}</p>
                  {step.hint}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="precios" className="scroll-mt-20 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Precios
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex flex-col px-7 py-6 ${
                    plan.highlight ? 'card-soft ring-2 ring-[var(--brand-primary)]' : 'card-soft'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {plan.name}
                  </p>
                  <p className="mt-2 font-display text-5xl font-semibold leading-none text-gray-900">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-lg font-normal text-gray-500">{plan.period}</span>
                    ) : null}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1 text-sm text-gray-600">
                    {plan.benefits.map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                  <Link
                    href="/registro"
                    className={`mt-5 inline-flex justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      plan.highlight
                        ? `${brand.buttonPrimary} hover:bg-[var(--brand-primary-hover)]`
                        : `${brand.buttonSecondary} rounded-full px-4 py-2.5`
                    }`}
                  >
                    Empezar
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-gray-100 bg-white/60 py-10 sm:py-12">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-semibold text-gray-900">
              Tu próximo cumple, sin perseguir.
            </h2>
            <Link href="/registro" className={`${brand.landingCtaPrimary} mt-7`}>
              Crear mi primer evento
            </Link>
            <p className="mt-4 text-xs text-gray-500">
              <span className="text-green-600">✓</span> Gratis · <span className="text-green-600">✓</span>{' '}
              Sin tarjeta
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-gray-500 sm:flex-row sm:px-6 sm:text-left">
          <p className={`text-base font-bold ${brand.navBrand}`}>MiParty</p>
          <p className="text-gray-500">Para familias.</p>
          <div className="flex gap-4">
            <Link href="/login" className="transition hover:text-gray-900">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="transition hover:text-gray-900">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
