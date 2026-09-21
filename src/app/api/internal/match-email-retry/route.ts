import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runMatchEmailRetryBatch } from '@/lib/matching/retry-match-notification-emails'

/**
 * Phase 3.6F – interner Endpunkt für den periodischen Match-E-Mail-Retry. KEINE Provider-/
 * User-Session-Autorisierung (§11/§40: ein Provider darf niemals selbst einen Retry für sich
 * auslösen) – ausschließlich über das Vercel-Cron-Secret-Muster geschützt: Vercel hängt bei
 * konfiguriertem `CRON_SECRET` automatisch den Header `Authorization: Bearer <CRON_SECRET>` an
 * jeden Cron-Request an (offizielles Vercel-Cron-Verhalten, keine neue Infrastruktur). Fehlt
 * `CRON_SECRET` in der Umgebung, wird JEDE Anfrage abgelehnt (fail-closed, dasselbe Prinzip wie
 * bei SESSION_SECRET/NEXT_PUBLIC_APP_URL – kein stiller unsicherer Fallback in Production).
 *
 * GET statt POST: Vercel Cron sendet ausschließlich GET-Requests an den konfigurierten Pfad.
 *
 * WICHTIG: Diese Route ist in src/app/api/internal/ (nicht src/app/api/) und in vercel.json als
 * Cron-Ziel eingetragen, ist aber technisch dennoch öffentlich erreichbar (Next.js kennt keinen
 * "nur intern"-Routenschutz) – die Sicherheit kommt ausschließlich vom Secret-Vergleich unten,
 * nicht vom Pfad. `CRON_SECRET` muss in den Vercel-Projekteinstellungen gesetzt sein, damit diese
 * Route in Production tatsächlich etwas tut (siehe Abschlussbericht).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)
  // timingSafeEqual wirft bei unterschiedlicher Länge statt false zurückzugeben -> Längenprüfung zuerst.
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  const result = await runMatchEmailRetryBatch()

  // Observability (Phase 3.6F §41): nur IDs/Zähler/Kategorien, keine E-Mail-Adressen, keine
  // Secrets, keine Jobinhalte.
  console.log('[match-email-retry]', {
    candidateCount: result.candidateCount,
    sent: result.outcomes.filter((o) => o.sent).length,
    notSent: result.outcomes.filter((o) => !o.sent).length,
  })

  return NextResponse.json({ ok: true, candidateCount: result.candidateCount })
}
