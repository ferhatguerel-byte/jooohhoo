import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendOfferAwardedEmail } from '@/lib/email'
import { handleApiError } from '@/lib/api-error'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics-events'

const awardSchema = z.object({ offerId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge vergeben.' }, { status: 403 })
  }

  try {
    const { offerId } = awardSchema.parse(await req.json())
    const db = getDb()

    const job = await db.query('SELECT id FROM jobs WHERE id = $1 AND auftraggeber_id = $2', [jobId, user.id])
    if (job.rows.length === 0) {
      return NextResponse.json({ error: 'Auftrag nicht gefunden.' }, { status: 404 })
    }

    const offer = await db.query(
      `SELECT o.subunternehmer_id, u.email, u.company_name, u.email_notifications
       FROM offers o JOIN users u ON u.id = o.subunternehmer_id
       WHERE o.id = $1 AND o.job_id = $2`,
      [offerId, jobId]
    )
    if (offer.rows.length === 0) {
      return NextResponse.json({ error: 'Angebot nicht gefunden.' }, { status: 404 })
    }

    await db.query(
      "UPDATE jobs SET status = 'closed', awarded_subunternehmer_id = $1 WHERE id = $2",
      [offer.rows[0].subunternehmer_id, jobId]
    )
    await db.query("UPDATE offers SET status = 'accepted' WHERE id = $1", [offerId])
    await db.query(
      "UPDATE offers SET status = 'declined' WHERE job_id = $1 AND id != $2 AND status = 'pending'",
      [jobId, offerId]
    )

    if (offer.rows[0].email_notifications) {
      try {
        await sendOfferAwardedEmail(offer.rows[0].email, offer.rows[0].company_name)
      } catch (emailErr) {
        console.error('Benachrichtigung fehlgeschlagen:', emailErr)
      }
    }

    track(ANALYTICS_EVENTS.OFFER_ACCEPTED, { jobId, offerId })
    // Phase 3.6G: OFFER_ACCEPTED übernimmt fachlich den Funnel-Schritt "Auftrag vergeben"
    // (JOB_AWARDED) – kein neuer, doppelter Event-Name (siehe src/lib/analytics.ts). Persistiert
    // erst NACH den erfolgreichen UPDATEs oben, nie bei einer fehlgeschlagenen Vergabe.
    try {
      await trackEvent({
        event: ANALYTICS_EVENTS.OFFER_ACCEPTED,
        actorUserId: user.id,
        providerId: offer.rows[0].subunternehmer_id,
        jobId,
        idempotencyKey: `job_awarded:${jobId}`,
      })
    } catch {
      // trackEvent() wirft bereits nie – Verteidigung in der Tiefe.
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht vergeben werden.')
  }
}
