import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'MiParty — Organiza el cumple perfecto',
  description: 'Crea tu invitación, comparte el enlace y gestiona las respuestas en un solo lugar.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className={`${geistSans.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
