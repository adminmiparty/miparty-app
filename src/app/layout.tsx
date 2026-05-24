import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BugReportWidget from "@/components/BugReportWidget";
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full font-sans antialiased`}
    >
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
      <body className={`${geistSans.className} min-h-full flex flex-col`}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
        <Analytics />
        <SpeedInsights />
        <BugReportWidget />
      </body>
    </html>
  );
}
