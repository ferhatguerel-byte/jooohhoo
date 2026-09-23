import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runMatchEmailRetryBatch } from '@/lib/matching/retry-match-notification-emails'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logEvent } from '@/lib/observability/logger'
import { getRequestId } from '@/lib/observability/request-id'

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
    // Phase 4.3 (Teil 7): bremst automatisiertes Durchprobieren des CRON_SECRET pro IP – zählt
    // ausschließlich fehlgeschlagene Versuche, ein korrekt authentifizierter Cron-Aufruf ist davon
    // nie betroffen. best-effort (.catch), ein Fehler hier darf die 401-Antwort nicht verhindern.
    await checkRateLimit('cron-match-email-retry-authfail', getClientIp(req), 20, 10).catch(() => {})
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  // Phase 4.3 (Teil 7): zusätzliche Obergrenze auch mit korrektem Secret – schützt gegen eine
  // fehlkonfigurierte/doppelt registrierte Cron-Quelle, die den Batch-Versand-Job unbeabsichtigt
  // im Kurztakt auslöst (jeder Lauf verschickt E-Mails). Ein einzelner globaler Bucket, da dieser
  // Endpunkt fachlich nur von EINER Cron-Quelle aufgerufen werden soll (siehe vercel.json:
  // "*/5 * * * *" = 12 reguläre Aufrufe/Stunde). 20/60min lässt der regulären Frequenz reichlich
  // Spielraum (manueller Debug-Aufruf, Cron-Jitter), blockt aber echtes Hämmern im Kurztakt.
  const withinBudget = await checkRateLimit('cron-match-email-retry', 'global', 20, 60)
  if (!withinBudget) {
    return NextResponse.json({ error: 'Rate-Limit für diesen internen Endpunkt erreicht.' }, { status: 429 })
  }

  const requestId = getRequestId(req)

  try {
    const result = await runMatchEmailRetryBatch()

    // Observability (Phase 3.6F §41, jetzt strukturiert Phase 4.4 Teil G): nur IDs/Zähler/
    // Kategorien, keine E-Mail-Adressen, keine Secrets, keine Jobinhalte.
    logEvent('match_email_retry_batch_completed', 'info', {
      requestId,
      operation: 'match_email_retry',
      candidateCount: result.candidateCount,
      sent: result.outcomes.filter((o) => o.sent).length,
      notSent: result.outcomes.filter((o) => !o.sent).length,
    })

    return NextResponse.json({ ok: true, candidateCount: result.candidateCount })
  } catch (err) {
    // Phase 4.4 (Teil D/6): ein fehlgeschlagener Cron-Batch-Lauf ist ein unerwarteter Fehler
    // (DB-/Resend-Fehler etc.) – strukturiert geloggt + ans Error-Tracking gemeldet.
    logEvent('match_email_retry_batch_failed', 'error', { requestId, operation: 'match_email_retry' }, err)
    return NextResponse.json({ error: 'Batch-Verarbeitung fehlgeschlagen.' }, { status: 500 })
  }
}
