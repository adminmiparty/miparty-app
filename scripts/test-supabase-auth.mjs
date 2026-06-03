import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const url = (env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m) || [])[1]?.trim()
const key = (env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m) || [])[1]?.trim()

console.log('SUPABASE_URL:', url)
console.log('ANON_KEY length:', key?.length ?? 0)

async function probe(label, path, init = {}) {
  const target = `${url}${path}`
  try {
    const res = await fetch(target, {
      ...init,
      headers: {
        apikey: key,
        ...(init.headers ?? {}),
      },
    })
    const text = await res.text()
    console.log(`${label}: ${res.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`)
  } catch (error) {
    const cause = error.cause ?? {}
    console.log(`${label}: FAIL ${error.message}`, cause.code ?? '', cause.message ?? '')
  }
}

await probe('auth/health', '/auth/v1/health')
await probe('auth/user (invalid jwt)', '/auth/v1/user', {
  headers: { Authorization: 'Bearer invalid-token' },
})
await probe('auth/token refresh (no body)', '/auth/v1/token?grant_type=refresh_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
