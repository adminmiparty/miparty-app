import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LandingFooter from '@/components/LandingFooter'
import LandingHeader from '@/components/LandingHeader'
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
    description: 'Guardas una vez. Lo reutilizas siempre.',
    detail: (
      <div className="rounded-xl border border-[var(--brand-border-light)] bg-[var(--brand-primary-light)]/60 p-3">
        <div className="flex items-center gap-2">
          {[
            { initial: 'S', name: 'Sofía', sub: '🌾 sin gluten' },
            { initial: 'M', name: 'Mateo', sub: '6 años' },
          ].map((child) => (
            <div
              key={child.name}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/80 bg-white/90 px-2 py-1.5 shadow-[var(--shadow-card)]"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${brand.avatarBrand}`}
              >
                {child.initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-gray-900">{child.name}</p>
                <p className="truncate text-[9px] text-gray-500">{child.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    emoji: '🔗',
    title: 'Un solo enlace',
    description: 'Invitación lista para WhatsApp.',
    detail: (
      <div className="rounded-xl bg-green-50/90 p-2.5 ring-1 ring-green-100/80">
        <div className="rounded-lg rounded-tl-sm bg-[#dcf8c6] px-2.5 py-2 text-[10px] leading-snug text-gray-800 shadow-sm">
          Cumple de Sofía 🎂{' '}
          <span className="font-medium text-blue-600 underline decoration-blue-600/30">
            miparty.app/e/sofia-7
          </span>
        </div>
        <p className="mt-1.5 text-center text-[9px] font-medium text-green-700/80">Listo para enviar</p>
      </div>
    ),
  },
  {
    emoji: '✅',
    title: 'Confirmaciones claras',
    description: 'Todo claro, al instante.',
    detail: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-green-100">
            8 ✓
          </span>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
            2 ⏳
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">1 ✕</span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] text-gray-500">
            <span className="font-medium text-gray-800">Laura G.</span> · Voy 🎉
          </p>
        </div>
      </div>
    ),
  },
  {
    emoji: '💬',
    title: 'Menos mensajes',
    description: 'Sin perseguir respuestas.',
    detail: (
      <div className="space-y-2">
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-2.5 py-2">
          <p className="text-[10px] text-gray-400 line-through decoration-gray-300">¿Vais a venir?</p>
          <p className="text-[10px] text-gray-400 line-through decoration-gray-300">¿Alguna alergia?</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--brand-accent-dark)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" aria-hidden />
          Respuestas en tu panel
        </span>
      </div>
    ),
  },
]

const steps = [
  {
    number: '1',
    title: 'Crea tu familia',
    description: 'Añade hijos y alergias.',
    hint: (
      <div className="mx-auto mt-1.5 max-w-[10rem] rounded-lg border border-[var(--brand-border-light)] bg-[var(--brand-primary-light)]/55 px-2.5 py-2 text-left">
        <div className="flex items-center gap-1.5">
          {['S', 'M'].map((initial) => (
            <span
              key={initial}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${brand.avatarBrand}`}
            >
              {initial}
            </span>
          ))}
          <span className="text-[9px] text-gray-500">Sofía · Mateo</span>
        </div>
        <p className="mt-1 text-[9px] text-amber-700/90">🌾 Alergias guardadas</p>
      </div>
    ),
  },
  {
    number: '2',
    title: 'Crea el evento',
    description: 'Fecha, lugar y menú.',
    hint: (
      <div className="mx-auto mt-1.5 max-w-[10.5rem] rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-left shadow-[var(--shadow-card)]">
        <p className="text-[10px] font-semibold text-gray-900">Cumple 7 de Sofía</p>
        <p className="mt-0.5 text-[9px] text-gray-500">18 mayo · 17:00</p>
        <p className="mt-0.5 truncate text-[9px] text-gray-400">Casa de Laura</p>
        <div className="mt-1.5 flex gap-1">
          {['18', '19', '20'].map((day, i) => (
            <span
              key={day}
              className={`flex h-5 w-5 items-center justify-center rounded text-[8px] font-medium ${
                i === 0
                  ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {day}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    number: '3',
    title: 'Comparte la invitación',
    description: 'Lista para WhatsApp.',
    hint: (
      <div className="mx-auto mt-1.5 max-w-[11rem] rounded-lg bg-green-50/90 p-1.5 ring-1 ring-green-100/70">
        <div className="rounded-md rounded-tl-sm bg-[#dcf8c6] px-2 py-1.5 text-left text-[9px] leading-snug text-gray-800">
          ¡Nos vemos! 🎂{' '}
          <span className="text-blue-600 underline decoration-blue-600/30">miparty.app/e/sofia-7</span>
        </div>
      </div>
    ),
  },
  {
    number: '4',
    title: 'Todo en un solo lugar',
    description: 'Sin 100 mensajes en el grupo.',
    hint: (
      <div className="mx-auto mt-1.5 max-w-[10.5rem] rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-[var(--shadow-card)]">
        <p className="truncate text-[9px] font-semibold text-gray-900">Cumple 7 de Sofía</p>
        <dl className="mt-1.5 grid grid-cols-3 gap-1 border-t border-gray-100 pt-1.5 text-center">
          <div>
            <dd className="text-sm font-semibold tabular-nums leading-none text-gray-900">8</dd>
            <dt className="mt-0.5 text-[8px] font-medium text-green-700">Confirm.</dt>
          </div>
          <div className="border-x border-gray-100">
            <dd className="text-sm font-semibold tabular-nums leading-none text-gray-900">2</dd>
            <dt className="mt-0.5 text-[8px] font-medium text-amber-700">Pend.</dt>
          </div>
          <div>
            <dd className="text-sm font-semibold tabular-nums leading-none text-gray-900">2</dd>
            <dt className="mt-0.5 text-[8px] font-medium text-amber-800/80">Alerg.</dt>
          </div>
        </dl>
      </div>
    ),
  },
]

type PricingPlan = {
  name: string
  price?: string
  priceSubtitle?: string
  priceLabel?: string
  description: string
  features?: string[]
  highlight: boolean
  comingSoon: boolean
  ctaLabel: string
  ctaHref?: string
}

const plans: PricingPlan[] = [
  {
    name: 'Un cumpleaños',
    price: '1,99 €',
    priceSubtitle: 'Por evento',
    description: 'Todo listo para organizar un cumpleaños sin perseguir mensajes.',
    features: [
      'Invitación compartible',
      'Confirmaciones automáticas',
      'Alergias y menú',
      'Panel para organizar',
    ],
    highlight: true,
    comingSoon: false,
    ctaLabel: 'Crear evento',
    ctaHref: '/registro',
  },
  {
    name: 'Pack familiar',
    priceLabel: 'Próximamente',
    description: 'Todos los cumpleaños de tu familia, en un solo lugar.',
    highlight: false,
    comingSoon: true,
    ctaLabel: 'Muy pronto',
  },
  {
    name: 'De por vida',
    priceLabel: 'Próximamente',
    description: 'Guarda recuerdos, invitados y celebraciones para siempre.',
    highlight: false,
    comingSoon: true,
    ctaLabel: 'Muy pronto',
  },
]

const previewCaptions = ['Panel', 'Invitación', 'Menú', 'WhatsApp'] as const

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
      <LandingHeader />

      <main>
        {/* Hero */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <div
            className="pointer-events-none absolute -left-24 top-8 hidden h-64 w-64 rounded-full bg-[var(--brand-primary-muted)]/50 blur-3xl lg:block"
            aria-hidden
          />
          <div className="relative max-w-[30rem] lg:max-w-[28rem]">
            <p className={`text-sm font-medium tracking-wide ${brand.textBrandDark}`}>Cumpleaños sin caos</p>
            <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.12] tracking-tight text-gray-900 sm:text-[2.5rem] lg:text-[3.15rem]">
              Todos tus cumpleaños
              <br />
              en un solo lugar
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-gray-600 sm:text-lg lg:mt-8 lg:max-w-[21rem] lg:text-[1.125rem] lg:leading-snug">
              Invita, recibe respuestas y organiza todo desde un solo lugar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-9">
              <Link href="/registro" className={brand.landingCtaPrimary}>
                Crear mi primer evento
              </Link>
              <a href="#como-funciona" className={brand.landingCtaSecondary}>
                Ver cómo funciona
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none lg:pl-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card-lg)] shadow-[0_12px_40px_rgba(67,45,42,0.14)] ring-1 ring-[var(--brand-border-light)] sm:aspect-[5/4] lg:aspect-[4/3] lg:min-h-[22rem]">
              <Image
                src="/landing-hero.png"
                alt="Padres organizando en casa mientras los niños disfrutan un cumpleaños en el jardín"
                fill
                className="object-cover object-[32%_center] scale-[1.03]"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div
                className="absolute inset-0 bg-gradient-to-br from-amber-100/35 via-[var(--brand-primary-light)]/20 to-transparent"
                aria-hidden
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#3d2c28]/12 via-transparent to-white/5"
                aria-hidden
              />
            </div>

            <div
              className="absolute -bottom-2 left-3 right-3 z-10 sm:-bottom-3 sm:left-5 sm:right-5 lg:-bottom-4 lg:left-6 lg:right-auto lg:w-[17.5rem]"
              aria-hidden
            >
              <div className="rounded-2xl border border-gray-100/90 bg-white/95 px-4 py-3.5 shadow-[0_8px_28px_rgba(67,45,42,0.1)] backdrop-blur-sm">
                <p className="truncate text-[15px] font-semibold text-gray-900">Cumple 7 de Sofía</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                  <div>
                    <dt className="sr-only">Confirmados</dt>
                    <dd className="text-lg font-semibold tabular-nums leading-none text-gray-900">8</dd>
                    <dd className="mt-1 text-[10px] font-medium leading-tight text-green-700">Confirmados</dd>
                  </div>
                  <div className="border-x border-gray-100 px-2">
                    <dt className="sr-only">Alergias</dt>
                    <dd className="text-lg font-semibold tabular-nums leading-none text-gray-900">2</dd>
                    <dd className="mt-1 text-[10px] font-medium leading-tight text-amber-700">Alergias</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Pendientes</dt>
                    <dd className="text-lg font-semibold tabular-nums leading-none text-gray-900">2</dd>
                    <dd className="mt-1 text-[10px] font-medium leading-tight text-gray-500">Pendientes</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-100 bg-white/60 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Menos caos. Más cumpleaños.
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
                  <p className="mt-1.5 text-[13.5px] leading-snug text-gray-600">{feature.description}</p>
                  <div className="mt-auto">{feature.detail}</div>
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
          className={`scroll-mt-20 border-t border-gray-100 py-8 sm:py-10 ${brand.pageBg}`}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Así de simple.
            </h2>
            <ol className="relative mt-6 grid gap-5 sm:grid-cols-2 sm:gap-4 lg:mt-7 lg:grid-cols-4 lg:gap-3">
              <div
                className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-4 hidden h-px bg-gray-300/20 lg:block"
                aria-hidden
              />
              {steps.map((step) => (
                <li key={step.number} className="relative z-[1] text-center">
                  <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] font-display text-base font-bold text-[var(--brand-on-primary)]">
                    {step.number}
                  </span>
                  <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-gray-900">{step.title}</h3>
                  <p className="mt-1 text-[13px] leading-snug text-gray-600">{step.description}</p>
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
                  className={`flex flex-col rounded-[var(--radius-card)] border px-7 py-6 ${
                    plan.highlight
                      ? 'border-[var(--brand-border-light)] bg-white shadow-[0_10px_36px_rgba(67,45,42,0.12)] ring-2 ring-[var(--brand-primary)]'
                      : 'border-[var(--border-soft)] bg-white/95 shadow-[var(--shadow-card)]'
                  } ${plan.comingSoon ? 'opacity-[0.97]' : ''}`}
                >
                  {plan.comingSoon ? (
                    <span className="mb-3 inline-flex self-start rounded-full bg-[var(--brand-primary-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--brand-accent-dark)]">
                      Próximamente
                    </span>
                  ) : null}
                  <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                  {plan.price ? (
                    <>
                      <p className="mt-2 font-display text-5xl font-semibold leading-none text-gray-900">
                        {plan.price}
                      </p>
                      {plan.priceSubtitle ? (
                        <p className="mt-1 text-sm text-gray-500">{plan.priceSubtitle}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 font-display text-3xl font-semibold leading-tight text-gray-700">
                      {plan.priceLabel}
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{plan.description}</p>
                  {plan.features ? (
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm text-gray-600">
                      {plan.features.map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex-1" aria-hidden />
                  )}
                  {plan.ctaHref ? (
                    <Link
                      href={plan.ctaHref}
                      className={`mt-5 inline-flex justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${brand.buttonPrimary} hover:bg-[var(--brand-primary-hover)]`}
                    >
                      {plan.ctaLabel}
                    </Link>
                  ) : (
                    <span
                      className="mt-5 inline-flex cursor-not-allowed justify-center rounded-full border border-[var(--brand-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-500 opacity-80"
                      aria-disabled
                    >
                      {plan.ctaLabel}
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
