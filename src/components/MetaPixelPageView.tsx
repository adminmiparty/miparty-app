'use client'

import { useEffect } from 'react'
import { trackViewContent } from '@/lib/meta-pixel'
import { trackViewContent as trackTikTokViewContent } from '@/lib/tiktok-pixel'

export default function MetaPixelPageView() {
  useEffect(() => {
    trackViewContent()
    trackTikTokViewContent()
  }, [])

  return null
}
