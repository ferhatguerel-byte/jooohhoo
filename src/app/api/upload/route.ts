import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/current-user'
import { getDb } from '@/lib/db'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'
import { optimizeImageIfNeeded } from '@/lib/image-optimize'

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

// Alle aktuell unterstützten Upload-Arten sind sensibel/nicht-öffentlich (Qualifikationsnachweise,
// Auftrags-Anhänge) – es gibt derzeit keinen echten öffentlichen Upload-Typ (Firmenlogo o.ä.)
// in der Anwendung. Deshalb werden ausnahmslos alle Dateien privat gespeichert.
const purposeSchema = z.enum(['qualification_file', 'job_attachment'])

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
    const purposeResult = purposeSchema.safeParse(formData.get('purpose'))
    if (!purposeResult.success) {
      return NextResponse.json({ error: 'Ungültiger Upload-Typ.' }, { status: 400 })
    }
    const purpose = purposeResult.data

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

    const { buffer, contentType } = await optimizeImageIfNeeded(file)

    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const pathname = `private/${purpose}/${user.id}/${randomUUID()}-${safeName}`
    const blob = await put(pathname, buffer, {
      access: 'private',
      addRandomSuffix: false,
      contentType,
    })

    const db = getDb()
    const inserted = await db.query(
      `INSERT INTO private_files (pathname, original_name, content_type, size_bytes, uploaded_by, purpose)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [blob.pathname, baseName, contentType, buffer.byteLength, user.id, purpose]
    )

    return NextResponse.json({ fileId: inserted.rows[0].id, name: baseName })
  } catch (err: unknown) {
    return handleApiError(err, 'Datei konnte nicht hochgeladen werden.')
  }
}
