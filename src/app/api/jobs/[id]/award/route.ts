import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendOfferAwardedEmail } from '@/lib/email'
import { handleApiError } from '@/lib/api-error'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics-events'

const awardSchema = z.object({ offerId: z.string().uuid() })

/**
 * Phase 3.6I – Award atomar und race-condition-sicher gemacht (vorher: drei unabhängige
 * `db.query()`-UPDATEs ohne gemeinsame Transaktion, kein `status = 'open'`-Guard gegen eine
 * parallele/doppelte Vergabe).
 *
 * Ablauf innerhalb EINER Transaktion:
 * 1. `SELECT ... FOR UPDATE` auf die Job-Zeile (Ownership-Filter bleibt erhalten) – sperrt die
 *    Zeile für die Dauer der Transaktion. Eine zweite, gleichzeitige Award-Anfrage für denselben
 *    Job blockiert an dieser Stelle, bis die erste Transaktion committet oder zurückrollt (Postgres
 *    Row-Level-Lock, keine neue Locking-Abstraktion, keine Advisory Locks nötig).
 * 2. Status-Guard: `job.status !== 'open'` → sauberer 409-Fehler, kein UPDATE. Dies fängt sowohl
 *    einen bereits vorher geschlossenen Job als auch – nach Freigabe der Sperre durch einen zuvor
 *    erfolgreichen parallelen Award – den unterlegenen zweiten Request ab (er sieht nach dem
 *    Entsperren den bereits committeten `status = 'closed'`-Zustand).
 * 3. Offer-Validierung: existiert, gehört zu diesem Job, UND `status = 'pending'` (bestehender
 *    `offer_status`-Enum, kein neuer Wert) – ein bereits akzeptiertes/abgelehntes Angebot kann
 *    nicht erneut vergeben werden.
 * 4. Erst danach die drei UPDATEs (Job schließen, Ziel-Offer akzeptieren, übrige Offers ablehnen)
 *    – alle über denselben `client`, also Teil derselben Transaktion.
 * 5. COMMIT. Bei jedem Fehler in 1–4: ROLLBACK, kein Teilzustand, kein Analytics-Event.
 *
 * Side Effects (E-Mail, Analytics) laufen weiterhin – wie schon vor dieser Phase – NACH dem
 * COMMIT und außerhalb der Transaktion (Teil G: kein E-Mail-Versand/Analytics-Schreibzugriff darf
 * einen DB-Rollback auslösen oder von einem noch offenen DB-Lock abhängen); daran wurde nichts
 * verändert.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge vergeben.' }, { status: 403 })
  }

  try {
    const { offerId } = awardSchema.parse(await req.json())
    const pool = getDb()

    const client = await pool.connect()
    let subunternehmerId: string
    let awardedOffer: { email: string; company_name: string; email_notifications: boolean }
    try {
      await client.query('BEGIN')

      // FOR UPDATE sperrt die Job-Zeile bis COMMIT/ROLLBACK – die alleinige Grundlage für die
      // Race-Condition-Sicherheit unten (Teil C/D).
      const job = await client.query('SELECT id, status FROM jobs WHERE id = $1 AND auftraggeber_id = $2 FOR UPDATE', [
        jobId,
        user.id,
      ])
      if (job.rows.length === 0) {
        throw new AwardBusinessError('Auftrag nicht gefunden.', 404)
      }
      if (job.rows[0].status !== 'open') {
        throw new AwardBusinessError('Dieser Auftrag ist nicht mehr offen und kann nicht (erneut) vergeben werden.', 409)
      }

      const offer = await client.query(
        `SELECT o.subunternehmer_id, u.email, u.company_name, u.email_notifications
         FROM offers o JOIN users u ON u.id = o.subunternehmer_id
         WHERE o.id = $1 AND o.job_id = $2 AND o.status = 'pending'`,
        [offerId, jobId]
      )
      if (offer.rows.length === 0) {
        throw new AwardBusinessError('Angebot nicht gefunden oder kann nicht mehr angenommen werden.', 404)
      }
      subunternehmerId = offer.rows[0].subunternehmer_id
      awardedOffer = offer.rows[0]

      await client.query("UPDATE jobs SET status = 'closed', awarded_subunternehmer_id = $1 WHERE id = $2", [
        subunternehmerId,
        jobId,
      ])
      await client.query("UPDATE offers SET status = 'accepted' WHERE id = $1", [offerId])
      await client.query("UPDATE offers SET status = 'declined' WHERE job_id = $1 AND id != $2 AND status = 'pending'", [
        jobId,
        offerId,
      ])

      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    if (awardedOffer.email_notifications) {
      try {
        await sendOfferAwardedEmail(awardedOffer.email, awardedOffer.company_name)
      } catch (emailErr) {
        console.error('Benachrichtigung fehlgeschlagen:', emailErr)
      }
    }

    track(ANALYTICS_EVENTS.OFFER_ACCEPTED, { jobId, offerId })
    // Phase 3.6G: OFFER_ACCEPTED übernimmt fachlich den Funnel-Schritt "Auftrag vergeben"
    // (JOB_AWARDED) – kein neuer, doppelter Event-Name (siehe src/lib/analytics.ts). Persistiert
    // erst NACH dem erfolgreichen Commit oben, nie bei Rollback/Fehler.
    try {
      await trackEvent({
        event: ANALYTICS_EVENTS.OFFER_ACCEPTED,
        actorUserId: user.id,
        providerId: subunternehmerId,
        jobId,
        idempotencyKey: `job_awarded:${jobId}`,
      })
    } catch {
      // trackEvent() wirft bereits nie – Verteidigung in der Tiefe.
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof AwardBusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return handleApiError(err, 'Auftrag konnte nicht vergeben werden.')
  }
}

/** Fachlicher Fehler innerhalb der Transaktion (löst gezielt ROLLBACK + einen sauberen HTTP-Status aus). */
class AwardBusinessError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
