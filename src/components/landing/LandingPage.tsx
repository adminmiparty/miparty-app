import Image from 'next/image'
import Link from 'next/link'
import { brand } from '@/lib/brand'

const features = [
  {
    emoji: '👨‍👩‍👧‍👦',
    title: 'Perfiles familiares',
    description: 'Guarda hijos, alergias y fechas una sola vez. Reutilízalos en cada cumple.',
  },
  {
    emoji: '🔗',
    title: 'Un solo enlace',
    description: 'Comparte la invitación por WhatsApp. Sin grupos eternos ni capturas perdidas.',
  },
  {
    emoji: '✅',
    title: 'Confirmaciones claras',
    description: 'Quién viene, quién no y cuántos adultos — todo en tu panel, al instante.',
  },
  {
    emoji: '🔔',
    title: 'Menos persecución',
    description: 'Recuerda quién falta por responder y organiza comida sin ir pregunta por pregunta.',
  },
]

const steps = [
  {
    number: '1',
    title: 'Crea tu familia',
    description: 'Añade a tus hijos y guarda alergias y apodos.',
  },
  {
    number: '2',
    title: 'Comparte el enlace',
    description: 'Una invitación bonita, lista para WhatsApp.',
  },
  {
    number: '3',
    title: 'Mira las respuestas',
    description: 'Confirmaciones y menú, ordenados solos.',
  },
]

const plans = [
  {
    name: 'Un evento',
    price: 'Gratis',
    detail: 'Para probar con el cumple de este año.',
    highlight: false,
  },
  {
    name: 'Plan familia',
    price: '9 €',
    period: '/ mes',
    detail: 'Eventos ilimitados, perfiles y recordatorios.',
    highlight: true,
  },
  {
    name: 'De por vida',
    price: '79 €',
    detail: 'Un pago. Toda la familia, para siempre.',
    highlight: false,
  },
]

function PreviewDashboard() {
  return (
    <div className="card-soft overflow-hidden p-4">
      <p className="text-sm font-semibold text-gray-900">Hola, Laura 👋</p>
      <p className="mt-0.5 text-xs text-gray-500">Tus cumpleaños, en un solo sitio</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {['Sofía', 'Mateo'].map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-2 shadow-[var(--shadow-card)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xs font-semibold text-yellow-800">
              {name[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-800">{name}</p>
              <p className="text-[10px] text-gray-400">6 años</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border-l-4 border-yellow-400 bg-white p-3 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold text-gray-900">Cumple 7 de Sofía</p>
        <p className="mt-0.5 text-[10px] text-gray-500">18 mayo · Parque del barrio</p>
        <p className="mt-1.5 text-[10px] font-medium text-green-700">8 confirmados · 2 pendientes</p>
      </div>
    </div>
  )
}

function PreviewRsvp() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-yellow-200 bg-gradient-to-b from-yellow-50 to-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-center text-xs font-medium text-yellow-600">Invitación</p>
      <p className="mt-1 text-center font-display text-lg font-semibold text-gray-900">Cumple 7 de Sofía</p>
      <p className="mt-0.5 text-center text-[10px] text-gray-500">Sábado 18 de mayo · 17:00</p>
      <div className="mt-3 space-y-1.5">
        <div className="rounded-lg bg-yellow-400 py-2 text-center text-xs font-semibold text-gray-900">
          ¡Voy! 🎉
        </div>
        <div className="rounded-lg border border-yellow-200 bg-white py-2 text-center text-xs text-gray-600">
          No podré ir
        </div>
      </div>
    </div>
  )
}

function PreviewFoodSummary() {
  return (
    <div className="card-soft p-4">
      <p className="text-xs font-semibold text-gray-900">Resumen para la fiesta</p>
      <ul className="mt-2 space-y-1.5 text-[11px] text-gray-600">
        <li className="flex justify-between gap-2">
          <span>Confirmados</span>
          <span className="font-medium text-gray-900">8 familias</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Sin gluten</span>
          <span className="font-medium text-amber-700">2</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Vegetariano</span>
          <span className="font-medium text-green-700">1</span>
        </li>
      </ul>
    </div>
  )
}

function PreviewWhatsApp() {
  return (
    <div className="rounded-2xl bg-[#e7f8ee] p-3 shadow-[var(--shadow-card)]">
      <div className="rounded-xl bg-white p-3">
        <p className="text-[10px] text-gray-400">WhatsApp · Grupo cumple Sofía</p>
        <div className="mt-2 max-w-[90%] rounded-lg rounded-tl-sm bg-[#dcf8c6] px-2.5 py-2 text-[11px] leading-snug text-gray-800">
          ¡Hola! Aquí está la invitación del cumple de Sofía 🎂
          <br />
          <span className="text-blue-600 underline">miparty.app/e/sofia-7</span>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing-cream min-h-screen text-gray-800">
      <header className="sticky top-0 z-40 border-b border-[var(--border-muted)] bg-[#fdf8f3]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight text-gray-900">
            Mi<span className="text-yellow-600">Party</span>
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
            <Link href="/registro" className={brand.dashboardPrimaryPill}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-amber-800/80">Para familias que organizan cumpleaños</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.25rem]">
              Todos tus cumpleaños en un solo lugar.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              Comparte un solo enlace y organiza invitados, alergias y confirmaciones desde un panel
              sencillo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-yellow-500"
              >
                Crear mi primer evento
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/70 px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-white"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card-lg)] shadow-[var(--shadow-modal)]">
              <Image
                src="https://images.unsplash.com/photo-1530103862673-de7c9ed5a4ef?auto=format&fit=crop&w=1200&q=80"
                alt="Familia celebrando un cumpleaños infantil"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>

            <div
              className="absolute -bottom-4 left-4 right-4 sm:-left-4 sm:right-auto sm:w-[min(100%,18rem)] lg:-bottom-6 lg:-left-6"
              aria-hidden
            >
              <div className="card-soft border-yellow-100/80 p-4 shadow-[var(--shadow-card-hover)]">
                <p className="text-sm font-semibold text-gray-900">Cumple 7 de Sofía</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-green-700">
                  <span aria-hidden>✅</span> 8 familias confirmadas
                </p>
                <p className="mt-2 text-xs text-gray-500">Sin gluten: 2 · Vegetariano: 1</p>
                <p className="mt-1 text-xs text-yellow-700">2 invitaciones pendientes</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-[var(--border-muted)] bg-white/50 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-sm font-medium text-yellow-700">Menos caos, más disfrute</p>
            <h2 className="mt-2 text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Lo esencial, bien hecho
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="card-soft flex flex-col p-5 transition hover:shadow-[var(--shadow-card-hover)]"
                >
                  <span className="text-2xl" aria-hidden>
                    {feature.emoji}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section id="producto" className="scroll-mt-20 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-sm font-medium text-amber-800/80">Ya está listo para usar</p>
            <h2 className="mt-2 text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Así se ve cuando lo usas
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-gray-600 sm:text-base">
              Panel, invitación y resumen — el mismo lenguaje visual que verás al crear tu evento.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <PreviewDashboard />
              <PreviewRsvp />
              <PreviewFoodSummary />
              <PreviewWhatsApp />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="como-funciona"
          className="scroll-mt-20 border-t border-[var(--border-muted)] bg-gradient-to-b from-yellow-50/80 to-[#fdf8f3] py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Tres pasos. Sin complicaciones.
            </h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 font-display text-lg font-semibold text-yellow-800">
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="precios" className="scroll-mt-20 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center font-display text-3xl font-semibold text-gray-900 sm:text-4xl">
              Precios claros, sin sorpresas
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-center text-sm text-gray-600">
              Empieza gratis. Paga solo si tu familia lo usa cada mes.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex flex-col rounded-[var(--radius-card-lg)] border p-6 transition ${
                    plan.highlight
                      ? 'border-yellow-300 bg-white shadow-[var(--shadow-card-hover)] ring-1 ring-yellow-200'
                      : 'border-[var(--border-soft)] bg-white/80 shadow-[var(--shadow-card)]'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-3 font-display text-3xl font-semibold text-gray-900">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-base font-normal text-gray-500">{plan.period}</span>
                    ) : null}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{plan.detail}</p>
                  <Link
                    href="/registro"
                    className={`mt-6 inline-flex justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      plan.highlight ? brand.buttonPrimary : brand.buttonSecondary
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
        <section className="border-t border-[var(--border-muted)] bg-white/60 py-14">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="font-display text-3xl font-semibold text-gray-900">
              Organiza el próximo cumple sin perseguir a nadie.
            </h2>
            <Link
              href="/registro"
              className="mt-8 inline-flex rounded-full bg-yellow-400 px-8 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-yellow-500"
            >
              Crear mi primer evento
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-muted)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-gray-500 sm:flex-row sm:px-6 sm:text-left">
          <p className="font-display text-base font-semibold text-gray-800">
            Mi<span className="text-yellow-600">Party</span>
          </p>
          <p>Hecho para familias que quieren celebrar con calma.</p>
          <div className="flex gap-4">
            <Link href="/login" className="transition hover:text-gray-800">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="transition hover:text-gray-800">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
