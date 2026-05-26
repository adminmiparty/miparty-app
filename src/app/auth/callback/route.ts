import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { metaRequestContext, sendMetaEvent } from '@/lib/meta-conversions-api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.created_at) {
        const createdMs = new Date(user.created_at).getTime()
        const isNewUser = Number.isFinite(createdMs) && Date.now() - createdMs < 60_000
        if (isNewUser) {
          const metaContext = metaRequestContext(request, '/registro')
          void sendMetaEvent({
            eventName: 'CompleteRegistration',
            eventSourceUrl: metaContext.eventSourceUrl,
            eventId: `registration-${user.id}`,
            userEmail: user.email ?? undefined,
            clientIpAddress: metaContext.clientIpAddress,
            clientUserAgent: metaContext.clientUserAgent,
          })
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('Auth callback error:', error.message)
      return NextResponse.redirect(
        `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
