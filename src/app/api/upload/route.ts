import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getCurrentUser } from '@/lib/current-user'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'

const MAX_SIZE = 10 * 1024 * 1024

// MIME-Type -> erlaubte Dateiendungen. Beide Werte kommen vom Client und können gefälscht
// werden, aber ein Angreifer muss dann Type UND Endung konsistent fälschen; eine ausführbare
// Datei getarnt als "bild.png" mit falschem Content-Type wird so trotzdem abgelehnt.
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Datei-Upload ist noch nicht konfiguriert.' }, { status: 500 })
  }

  try {
    await enforceRateLimit(
      'upload:user',
      user.id,
      20,
      60,
      'Sie haben das Upload-Limit erreicht. Bitte versuchen Sie es später erneut.'
    )
    await enforceRateLimit('upload:ip', getClientIp(req), 40, 60)

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Datei ist zu groß (max. 10 MB).' }, { status: 400 })
    }

    const allowedExtensions = ALLOWED_TYPES[file.type]
    if (!allowedExtensions) {
      return NextResponse.json({ error: 'Nur PDF- oder Bilddateien (JPG, PNG, WEBP, HEIC) sind erlaubt.' }, { status: 400 })
    }

    // Endung ausschließlich aus dem Basisnamen ableiten (kein Pfadanteil), um Path-Traversal
    // und mehrdeutige Doppel-Endungen (z.B. "x.php.png") zu erkennen.
    const baseName = file.name.replace(/^.*[/\\]/, '')
    const extMatch = /\.([a-zA-Z0-9]+)$/.exec(baseName)
    const extension = extMatch?.[1]?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      return NextResponse.json({ error: 'Dateiendung passt nicht zum Dateityp.' }, { status: 400 })
    }

    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const blob = await put(`${user.id}/${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })
    return NextResponse.json({ url: blob.url, name: baseName })
  } catch (err: unknown) {
    return handleApiError(err, 'Datei konnte nicht hochgeladen werden.')
  }
}
