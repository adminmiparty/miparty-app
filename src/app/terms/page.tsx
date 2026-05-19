import type { Metadata } from 'next'
import LegalPageShell, { LegalContact, LegalSection } from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Terms of Service | MiParty',
  description: 'Terms for using the MiParty family event organization platform.',
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <LegalSection title="About MiParty">
        <p>
          MiParty is a family event organization platform. It helps you create invitations, manage
          RSVPs, and keep celebration details in one place.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You are responsible for the content you publish through MiParty, including invitation text,
          images, locations, and messages to guests. Please share accurate information and only
          content you have the right to use.
        </p>
      </LegalSection>

      <LegalSection title="Service provided as-is">
        <p>
          MiParty is provided &quot;as is&quot; and &quot;as available.&quot; We work to keep the
          platform reliable, but we do not guarantee uninterrupted access or that every feature will
          meet every specific need.
        </p>
      </LegalSection>

      <LegalSection title="Respectful use">
        <p>
          You agree to use MiParty lawfully and respectfully. Do not harass others, upload harmful
          material, attempt to disrupt the service, or misuse guest or family data you access through
          the platform.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact />
      </LegalSection>
    </LegalPageShell>
  )
}
