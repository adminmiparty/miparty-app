'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { brand } from '@/lib/brand'

type AccountMenuProps = {
  signedOut: ReactNode
  /** When set, called for in-app menu links before navigation. Call `preventDefault()` to block. */
  onInternalNavigate?: (href: string, event: ReactMouseEvent<HTMLAnchorElement>) => void
}

function isGoogleLinked(user: User) {
  if (user.app_metadata?.provider === 'google') return true
  return user.identities?.some((identity) => identity.provider === 'google') ?? false
}

function getGoogleAvatarUrl(user: User): string | null {
  if (!isGoogleLinked(user)) return null
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const raw = meta?.avatar_url ?? meta?.picture
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function AccountAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [avatarUrl])

  const showImage = Boolean(avatarUrl) && !imageFailed

  if (showImage && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${brand.avatarBrand}`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export default function AccountMenu({ signedOut, onInternalNavigate }: AccountMenuProps) {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const syncAccount = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDisplayName(null)
      setAvatarUrl(null)
      return
    }

    setAvatarUrl(getGoogleAvatarUrl(user))

    const { data: profile } = await supabase
      .from('users')
      .select('first_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.first_name) {
      setDisplayName(profile.first_name)
      return
    }

    const full = user.user_metadata?.full_name as string | undefined
    const name = full?.split(' ')[0] || user.email?.split('@')[0] || null
    setDisplayName(name)
  }

  useEffect(() => {
    const supabase = createClient()

    void syncAccount()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAccount()
    })

    window.addEventListener('profile-updated', syncAccount)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('profile-updated', syncAccount)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!displayName) {
    return <>{signedOut}</>
  }

  return (
    <div className="relative min-w-0 shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-expanded={showDropdown}
        aria-haspopup="menu"
        aria-label={`Menú de cuenta, ${displayName}`}
        className="flex items-center gap-0 rounded-full p-1 text-sm transition hover:bg-[var(--brand-primary-light)] sm:gap-2 sm:py-1 sm:pl-1 sm:pr-2.5"
      >
        <AccountAvatar name={displayName} avatarUrl={avatarUrl} />
        <span className="hidden max-w-[10rem] truncate font-medium text-gray-900 sm:inline">
          {displayName}
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 shrink-0 text-gray-400 transition sm:block ${showDropdown ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {showDropdown ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11.5rem] overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-[var(--shadow-card)]"
        >
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={(e) => {
              setShowDropdown(false)
              onInternalNavigate?.('/dashboard', e)
            }}
            className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-[var(--brand-primary-light)]"
          >
            MiPanel
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="flex w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  )
}
