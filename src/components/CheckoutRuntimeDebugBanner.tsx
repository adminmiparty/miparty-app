'use client'

import { useEffect, useState } from 'react'

/** TEMP: visible host/origin/build banner for mobile vs desktop Stripe checkout debugging. */
export default function CheckoutRuntimeDebugBanner() {
  const [client, setClient] = useState<{
    host: string
    origin: string
    href: string
  } | null>(null)

  useEffect(() => {
    setClient({
      host: window.location.host,
      origin: window.location.origin,
      href: window.location.href,
    })
    console.log('[publish/checkout] runtime banner', {
      host: window.location.host,
      origin: window.location.origin,
      href: window.location.href,
      vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? null,
      commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
    })
  }, [])

  const buildId = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'n/a'
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'n/a'

  return (
    <div
      className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 font-mono text-[10px] leading-snug text-amber-950"
      role="status"
      aria-label="Diagnóstico temporal de checkout"
    >
      <p className="font-semibold text-amber-900">Checkout debug (temp)</p>
      <p>host: {client?.host ?? '…'}</p>
      <p>origin: {client?.origin ?? '…'}</p>
      <p>
        build: {buildId} · env: {vercelEnv}
      </p>
    </div>
  )
}
