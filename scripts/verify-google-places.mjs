import fs from 'node:fs'

const envText = fs.readFileSync('.env.local', 'utf8')
const match = envText.match(/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.*)$/m)
const key = match ? match[1].trim().replace(/^["']|["']$/g, '') : ''

if (!key) {
  console.log('KEY: missing in .env.local')
  process.exit(1)
}

console.log(`KEY: present (length=${key.length})`)

const scriptUrl =
  'https://maps.googleapis.com/maps/api/js?' +
  new URLSearchParams({
    key,
    loading: 'async',
    libraries: 'places',
    v: 'weekly',
  }).toString()

const scriptRes = await fetch(scriptUrl)
const scriptText = await scriptRes.text()
console.log(`MAPS_JS_SCRIPT: status=${scriptRes.status}`)

const jsErrors = [
  'InvalidKeyMapError',
  'ApiNotActivatedMapError',
  'RefererNotAllowedMapError',
  'BillingNotEnabledMapError',
]
const foundJsError = jsErrors.find((e) => scriptText.includes(e))
if (foundJsError) {
  console.log(`MAPS_JS_ERROR: ${foundJsError}`)
} else if (scriptText.includes('google.maps') || scriptText.includes('importLibrary')) {
  console.log('MAPS_JS: script body looks valid')
} else {
  console.log('MAPS_JS_BODY_PREFIX:', scriptText.slice(0, 200).replace(/\s+/g, ' '))
}

const acRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.placeId',
  },
  body: JSON.stringify({
    input: 'Burger King Marbella',
    includedRegionCodes: ['es'],
    languageCode: 'es',
  }),
})

const acText = await acRes.text()
console.log(`PLACES_NEW: status=${acRes.status}`)

if (acRes.ok) {
  const data = JSON.parse(acText)
  const count = data.suggestions?.length ?? 0
  console.log(`PLACES_NEW: ok, suggestions=${count}`)
  if (count > 0) {
    const sample = data.suggestions[0]?.placePrediction?.text?.text
    console.log(`PLACES_NEW sample: ${sample ?? '(no text)'}`)
  }
} else {
  console.log('PLACES_NEW error:', acText.slice(0, 500))
}

try {
  const pageRes = await fetch('http://localhost:3000/dashboard/eventos/nuevo')
  const html = await pageRes.text()
  console.log(`LOCAL_PAGE: status=${pageRes.status}`)
  console.log(`KEY in page HTML: ${html.includes(key.slice(0, 12))}`)

  const scriptPaths = [
    ...html.matchAll(/src="(\/_next\/[^"]+)"/g),
    ...html.matchAll(/href="(\/_next\/[^"]+\.js[^"]*)"/g),
  ].map((m) => m[1])

  let keyInBundle = false
  for (const path of scriptPaths) {
    const chunk = await fetch(`http://localhost:3000${path}`).then((r) => r.text())
    if (chunk.includes(key.slice(0, 12))) {
      keyInBundle = true
      console.log(`KEY inlined in bundle: yes (${path.slice(0, 72)}...)`)
      break
    }
  }
  if (!keyInBundle) {
    console.log('KEY inlined in bundle: no (restart dev server after editing .env.local)')
  }
} catch {
  console.log('LOCAL_PAGE: fetch failed (dev server may be down)')
}
