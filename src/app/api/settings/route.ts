import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const KEYS = ['google_maps_api_key', 'resend_api_key', 'absender_firma', 'absender_name', 'absender_email', 'absender_tel', 'email_from']

export async function GET() {
  const settings: Record<string, string> = {}
  for (const key of KEYS) {
    settings[key] = db.getSetting(key) || ''
  }
  // Mask API keys
  if (settings.google_maps_api_key) settings.google_maps_api_key = settings.google_maps_api_key.slice(0, 8) + '••••••••'
  if (settings.resend_api_key) settings.resend_api_key = settings.resend_api_key.slice(0, 5) + '••••••••'
  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  for (const [key, value] of Object.entries(data)) {
    if (KEYS.includes(key) && typeof value === 'string' && !value.includes('••')) {
      db.setSetting(key, value)
    }
  }
  return NextResponse.json({ ok: true })
}
