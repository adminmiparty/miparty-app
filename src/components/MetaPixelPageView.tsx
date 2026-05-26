'use client'

import { useEffect } from 'react'
import { trackViewContent } from '@/lib/meta-pixel'

export default function MetaPixelPageView() {
  useEffect(() => {
    trackViewContent()
  }, [])

  return null
}
