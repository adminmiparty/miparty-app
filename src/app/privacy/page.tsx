import type { Metadata } from 'next'
import LegalPageShell, { LegalContact, LegalSection } from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy | MiParty',
  description: 'How MiParty collects, uses, and protects your family and event data.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <LegalSection title="Overview">
        <p>
          MiParty helps families organize birthdays and celebrations. This policy explains what
          information we collect and how we use it. We keep things simple and never sell your data.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>Depending on how you use MiParty, we may process:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Google sign-in:</strong> if
            you register or log in with Google, we receive basic account details such as your name,
            email address, and profile photo provided by Google.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Account and family data:</strong>{' '}
            names, contact details, partner information, and child profiles you add to your account.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Event information:</strong>{' '}
            titles, dates, locations, invitation content, RSVP responses, food preferences, and
            related notes you choose to store for your events.
          </li>
          <li>
            <strong className="font-medium text-[var(--brand-text)]">Allergies and child details:</strong>{' '}
            information you enter about children (including allergies or dietary needs) so you can
            plan celebrations safely.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use your information">
        <p>We use this data only to operate MiParty: hosting your account, saving your events,
          showing RSVPs to organizers, and improving the service. We do not use your family or
          children&apos;s information for advertising profiles.</p>
      </LegalSection>

      <LegalSection title="We do not sell your data">
        <p>
          We do not sell, rent, or trade your personal information to third parties for marketing
          purposes.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact />
      </LegalSection>
    </LegalPageShell>
  )
}
