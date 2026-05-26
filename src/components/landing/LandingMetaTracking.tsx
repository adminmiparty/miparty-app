'use client'

import { useEffect } from 'react'
import { trackLead, trackViewContent } from '@/lib/meta-pixel'

export function LandingPageViewTracker() {
  useEffect(() => {
    trackViewContent()
  }, [])

  return null
}

export function trackLandingCrearEventoClick(): void {
  trackLead('crear_evento')
}

export function trackLandingCrearCuentaClick(): void {
  trackLead('crear_cuenta')
}
