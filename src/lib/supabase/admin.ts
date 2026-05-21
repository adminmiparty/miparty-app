import { createClient } from '@supabase/supabase-js'
import { readServerEnv } from '@/lib/envServer'

/** Service-role client for webhooks and trusted server writes. Never import in client components. */
export function createAdminClient() {
  const url = readServerEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = readServerEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Missing Supabase admin credentials')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
