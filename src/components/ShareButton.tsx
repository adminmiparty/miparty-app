'use client'

import { useState } from 'react'

interface ShareButtonProps {
  eventTitle: string
  childName: string
  slug: string
  className?: string
}

export default function ShareButton({ eventTitle, childName, slug, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareData = {
      title: eventTitle,
      text: `¡Hola! Te comparto la invitación al cumple de ${childName} 🎉`,
      url: `https://miparty.net/e/${slug}`,
    }
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(shareData.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button type="button" onClick={handleShare} className={className}>
      {copied ? '¡Enlace copiado!' : 'Compartir invitación'}
    </button>
  )
}
