import type { ReactNode } from 'react'
import { brand } from '@/lib/brand'

export const authCardClassName =
  'w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-6'

type AuthPageShellProps = {
  children: ReactNode
}

/** Centered auth layout — shared mobile + desktop spacing and safe areas */
export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main
      className={`min-h-screen min-h-[100dvh] ${brand.pageBg} px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-10 sm:pb-12`}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-4 py-2 sm:min-h-[calc(100vh-5rem)] sm:gap-6 sm:py-6">
        {children}
      </div>
    </main>
  )
}
