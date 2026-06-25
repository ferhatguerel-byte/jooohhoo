import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { gewerk, city, apiKey, maxResults = 20 } = await req.json()

  const key = apiKey || db.getSetting('google_maps_api_key')
  if (!key) {
    return NextResponse.json({ error: 'Kein Google Maps API-Key. Bitte in den Einstellungen hinterlegen.' }, { status: 400 })
  }

  const query = `${gewerk} ${city}`
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=de&region=de&key=${key}`

  const res = await fetch(url)
  if (!res.ok) {
    return NextResponse.json({ error: 'Google Maps API Fehler' }, { status: 500 })
  }
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ error: `Google API: ${data.status} - ${data.error_message || ''}` }, { status: 400 })
  }

  const results = (data.results || []).slice(0, maxResults)
  const imported: string[] = []

  for (const place of results) {
    // Get details for phone/website
    let phone = ''
    let website = ''
    let email = ''

    try {
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,name&language=de&key=${key}`
      const detailRes = await fetch(detailUrl)
      const detail = await detailRes.json()
      phone = detail.result?.formatted_phone_number || ''
      website = detail.result?.website || ''
      // Derive email from website domain if possible
      if (website) {
        try {
          const domain = new URL(website).hostname.replace('www.', '')
          email = `info@${domain}`
        } catch { /* ignore */ }
      }
    } catch { /* ignore detail fetch errors */ }

    const address = place.formatted_address || ''
    const cityMatch = address.match(/\d{5}\s+(.+?)(?:,|$)/)
    const cityName = cityMatch ? cityMatch[1].trim() : city

    const id = db.createLead({
      company_name: place.name,
      email,
      phone,
      website,
      address,
      city: cityName,
      gewerk,
      rating: place.rating,
      review_count: place.user_ratings_total,
      source: 'google_maps',
      status: 'neu',
      maps_place_id: place.place_id,
    })
    imported.push(id)
  }

  if (apiKey) db.setSetting('google_maps_api_key', apiKey)

  return NextResponse.json({ imported: imported.length, total: results.length })
}
