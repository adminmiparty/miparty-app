import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BugReportWidget from "@/components/BugReportWidget";
import MetaPixel from "@/components/MetaPixel";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: 'MiParty — Organiza el cumple perfecto',
  description: 'Crea tu invitación, comparte el enlace y gestiona las respuestas en un solo lugar.',
  openGraph: {
    title: 'MiParty — Organiza el cumple perfecto',
    description: 'Crea tu invitación, comparte el enlace y gestiona las respuestas en un solo lugar.',
    url: 'https://miparty.net',
    siteName: 'MiParty',
    images: [
      {
        url: 'https://miparty.net/landing-hero.png',
        width: 1200,
        height: 630,
        alt: 'MiParty — Organiza cumpleaños sin el caos',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiParty — Organiza el cumple perfecto',
    description: 'Crea tu invitación, comparte el enlace y gestiona las respuestas en un solo lugar.',
    images: ['https://miparty.net/landing-hero.png'],
  },
  metadataBase: new URL('https://miparty.net'),
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full font-sans antialiased`}
    >
      <head>
        <meta
          name="facebook-domain-verification"
          content="kahvtwp4tj9y068qrykko0wrb3hykp"
        />
      </head>
      <body className={`${geistSans.className} min-h-full flex flex-col`}>
        <MetaPixel />
        {children}
        <Analytics />
        <SpeedInsights />
        <BugReportWidget />
      </body>
    </html>
  );
}
