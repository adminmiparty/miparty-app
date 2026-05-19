import type { Metadata } from 'next'
import LegalPageShell, { LegalContact, LegalSection } from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Política de privacidad | MiParty',
  description:
    'Cómo MiParty recopila, utiliza y protege los datos de tu familia y de tus eventos.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Política de privacidad">
      <LegalSection title="Resumen">
        <p>
          MiParty ayuda a las familias a organizar cumpleaños y celebraciones. Esta política
          explica qué información recopilamos y cómo la utilizamos. Lo mantenemos sencillo: nunca
          vendemos tus datos.
        </p>
      </LegalSection>

      <LegalSection title="Información que recopilamos">
        <p>Según cómo uses MiParty, podemos tratar:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Inicio de sesión con Google:</strong>{' '}
            si te registras o accedes con Google, recibimos datos básicos de tu cuenta, como tu
            nombre, correo electrónico y foto de perfil facilitados por Google.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Datos de cuenta y familia:</strong>{' '}
            nombres, datos de contacto, información de tu pareja y perfiles infantiles que añadas a
            tu cuenta.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Información de eventos:</strong>{' '}
            títulos, fechas, lugares, contenido de invitaciones, confirmaciones de asistencia,
            preferencias de comida y notas relacionadas que decidas guardar para tus eventos.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Alergias y datos de menores:</strong>{' '}
            información que introduces sobre los niños (incluidas alergias o necesidades
            alimentarias) para que puedas planificar las celebraciones con tranquilidad.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cómo usamos tu información">
        <p>
          Utilizamos estos datos únicamente para hacer funcionar MiParty: alojar tu cuenta, guardar
          tus eventos, mostrar las confirmaciones a quien organiza y mejorar el servicio. No
          utilizamos la información de tu familia ni de tus hijos para crear perfiles publicitarios.
        </p>
      </LegalSection>

      <LegalSection title="No vendemos tus datos">
        <p>
          No vendemos, alquilamos ni cedemos tu información personal a terceros con fines
          comerciales o de marketing.
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <LegalContact />
      </LegalSection>
    </LegalPageShell>
  )
}
