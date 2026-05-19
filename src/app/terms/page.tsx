import type { Metadata } from 'next'
import LegalPageShell, { LegalContact, LegalSection } from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Términos del servicio | MiParty',
  description: 'Condiciones de uso de la plataforma MiParty para organizar eventos familiares.',
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Términos del servicio">
      <LegalSection title="Qué es MiParty">
        <p>
          MiParty es una plataforma para organizar eventos en familia. Te ayuda a crear
          invitaciones, gestionar confirmaciones de asistencia y tener todos los detalles de la
          celebración en un solo sitio.
        </p>
      </LegalSection>

      <LegalSection title="Tu contenido">
        <p>
          Eres responsable del contenido que publicas en MiParty, incluidos textos de invitación,
          imágenes, ubicaciones y mensajes a los invitados. Comparte información veraz y solo
          contenido que tengas derecho a utilizar.
        </p>
      </LegalSection>

      <LegalSection title="Servicio prestado «tal cual»">
        <p>
          MiParty se ofrece «tal cual» y «según disponibilidad». Trabajamos para que la plataforma
          sea fiable, pero no garantizamos un acceso ininterrumpido ni que cada función cubra
          cualquier necesidad concreta.
        </p>
      </LegalSection>

      <LegalSection title="Uso respetuoso">
        <p>
          Te comprometes a utilizar MiParty de forma lícita y respetuosa. No acoses a otras
          personas, subas material dañino, intentes alterar el servicio ni uses de forma indebida
          los datos de invitados o familiares a los que accedas a través de la plataforma.
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <LegalContact />
      </LegalSection>
    </LegalPageShell>
  )
}
