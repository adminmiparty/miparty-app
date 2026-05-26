'use client'

import { useEffect } from 'react'
import { trackLead, trackViewContent } from '@/lib/meta-pixel'
import {
  trackLead as trackTikTokLead,
  trackViewContent as trackTikTokViewContent,
} from '@/lib/tiktok-pixel'

export function LandingPageViewTracker() {
  useEffect(() => {
    trackViewContent()
    trackTikTokViewContent()
  }, [])

  return null
}

export function trackLandingCrearEventoClick(): void {
  trackLead('crear_evento')
  trackTikTokLead('crear_evento')
}

export function trackLandingCrearCuentaClick(): void {
  trackLead('crear_cuenta')
  trackTikTokLead('crear_cuenta')
}
