import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { getDb } from '@/lib/db'
import { requireAuthenticatedUserApi, isAdmin, AuthorizationError } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'

/**
 * Einziger Zugriffsweg auf private Uploads (Qualifikationsnachweise, Auftrags-Anhänge).
 * Die zugrunde liegende Blob-URL ist niemals im Client bekannt – jede Anfrage prüft
 * serverseitig neu, ob der angemeldete Nutzer tatsächlich Zugriff auf genau diese Datei hat.
 * Bloße Kenntnis der fileId (UUID) reicht ohne diese Prüfung nicht aus.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = await params
  try {
    const user = await requireAuthenticatedUserApi()
    const db = getDb()

    const fileResult = await db.query(
      'SELECT id, pathname, original_name, content_type, uploaded_by, purpose FROM private_files WHERE id = $1',
      [fileId]
    )
    if (fileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Datei nicht gefunden.' }, { status: 404 })
    }
    const file = fileResult.rows[0]
    const admin = isAdmin(user)

    let authorized = admin || file.uploaded_by === user.id

    if (!authorized && file.purpose === 'job_attachment') {
      const jobResult = await db.query(
        `SELECT id, auftraggeber_id, status FROM jobs WHERE attachments @> $1::jsonb LIMIT 1`,
        [JSON.stringify([{ fileId: file.id }])]
      )
      const job = jobResult.rows[0]
      if (job) {
        if (job.auftraggeber_id === user.id) {
          authorized = true
        } else if (job.status === 'open' && user.role === 'subunternehmer') {
          // Entspricht der bisherigen Sichtbarkeit im offenen Auftrags-Marktplatz UND dessen
          // Zugriffsvoraussetzungen (Phase 4.1): dashboard/layout.tsx sperrt gesperrte Konten
          // (account_status='suspended') vollständig aus /dashboard/*, dashboard/jobs/page.tsx
          // zeigt die Auftragsliste (und damit auch die Anhänge) nur bei aktivem Abo. Bewusst
          // NICHT zusätzlich blockedGewerke/Verifizierung geprüft – diese schränken laut
          // bestehender UI nur die Angebotsabgabe ein, nicht die reine Sichtbarkeit der Liste.
          authorized =
            user.accountStatus === 'active' &&
            user.subscriptionStatus === 'active' &&
            !!user.subscriptionTier
        } else {
          const offerResult = await db.query(
            'SELECT 1 FROM offers WHERE job_id = $1 AND subunternehmer_id = $2 LIMIT 1',
            [job.id, user.id]
          )
          authorized = offerResult.rows.length > 0
        }
      }
    }

    if (!authorized) {
      throw new AuthorizationError('Kein Zugriff auf diese Datei.', 403)
    }

    const blob = await get(file.pathname, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: 'Datei nicht gefunden.' }, { status: 404 })
    }

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        'Content-Type': file.content_type,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.original_name)}"`,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    })
  } catch (err: unknown) {
    return handleApiError(err, 'Datei konnte nicht geladen werden.')
  }
}
