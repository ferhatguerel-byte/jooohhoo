import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getCurrentUser } from '@/lib/current-user'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Datei-Upload ist noch nicht konfiguriert.' }, { status: 500 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Datei ist zu groß (max. 10 MB).' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Nur PDF- oder Bilddateien (JPG, PNG, WEBP, HEIC) sind erlaubt.' }, { status: 400 })
  }

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const blob = await put(`${user.id}/${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url, name: file.name })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Upload Fehler:', message)
    return NextResponse.json({ error: 'Datei konnte nicht hochgeladen werden.' }, { status: 500 })
  }
}
