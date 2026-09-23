import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE } from '@/lib/gewerke'
import { handleApiError } from '@/lib/api-error'
import { ANALYTICS_EVENTS } from '@/lib/analytics'
import { trackEvent } from '@/lib/analytics-events'
import { runMatchingForJob } from '@/lib/matching/run-matching'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'
import { readJsonBody } from '@/lib/security/request-limits'
import { captureError } from '@/lib/observability/sentry'

const lineItemSchema = z.object({
  gewerk: z.enum(GEWERKE),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

const attachmentSchema = z.object({ fileId: z.string().uuid(), name: z.string().max(255) })

// Phase 4.3 (Teil D): title/description hatten bisher nur eine Mindestlänge, keine
// Maximallänge – ein unbegrenztes Freitextfeld (Spam/Payload-Aufblähung, Audit-Fund).
const jobSchema = z.object({
  title: z.string().min(5).max(200),
  gewerk: z.enum(GEWERKE),
  plz: z.string().min(4).max(10),
  ort: z.string().min(2).max(100),
  description: z.string().min(20).max(5000),
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),
  deadline: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
  estimatedCostMin: z.number().int().positive().optional(),
  estimatedCostMax: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Aufträge einstellen.' }, { status: 403 })
  }

  try {
    // Phase 4.3 (Teil 2/A): Job-Erstellung hatte kein Rate Limit (Audit-Fund) – ein
    // Auftraggeber-Konto könnte sonst unbegrenzt viele Aufträge anlegen (Spam, löst jeweils
    // Matching + Benachrichtigungs-E-Mails an Unternehmer aus). Zwei unabhängige Limits wie
    // beim bestehenden Upload-Endpunkt (pro Nutzer UND pro IP), damit weder ein kompromittiertes
    // Konto noch mehrere Konten von derselben Quelle das eigentliche Ziel umgehen.
    const body = jobSchema.parse(await readJsonBody(req))

    await rateLimit({ key: `jobs-create:${user.id}`, limit: 10, windowSeconds: 3600 })
    await rateLimit({ key: `jobs-create-ip:${getClientIp(req)}`, limit: 20, windowSeconds: 3600 })

    const pool = getDb()

    if (body.attachments && body.attachments.length > 0) {
      // Nur eigene, tatsächlich als Auftrags-Anhang hochgeladene Dateien akzeptieren.
      const ownedFiles = await pool.query(
        `SELECT id FROM private_files WHERE id = ANY($1::uuid[]) AND uploaded_by = $2 AND purpose = 'job_attachment'`,
        [body.attachments.map((a) => a.fileId), user.id]
      )
      if (ownedFiles.rows.length !== body.attachments.length) {
        return NextResponse.json({ error: 'Eine der Dateien konnte Ihrem Konto nicht zugeordnet werden.' }, { status: 400 })
      }
    }

    const client = await pool.connect()
    let jobId: string
    try {
      await client.query('BEGIN')

      const result = await client.query(
        `INSERT INTO jobs (auftraggeber_id, title, gewerk, plz, ort, description, budget_min, budget_max, deadline, attachments, estimated_cost_min, estimated_cost_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          user.id,
          body.title,
          body.gewerk,
          body.plz,
          body.ort,
          body.description,
          body.budgetMin || null,
          body.budgetMax || null,
          body.deadline || null,
          JSON.stringify(body.attachments || []),
          body.estimatedCostMin || null,
          body.estimatedCostMax || null,
        ]
      )
      jobId = result.rows[0].id

      if (body.lineItems && body.lineItems.length > 0) {
        for (let i = 0; i < body.lineItems.length; i++) {
          const item = body.lineItems[i]
          await client.query(
            `INSERT INTO job_line_items (job_id, position_order, gewerk, title, description)
             VALUES ($1, $2, $3, $4, $5)`,
            [jobId, i, item.gewerk, item.title, item.description || null]
          )
        }
      }

      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    // Phase 3.6G: PROJECT_CREATED wird erst NACH dem erfolgreichen COMMIT persistiert (best-effort,
    // wirft nie – ein Analytics-Fehler darf eine erfolgreiche Auftragserstellung nie beeinflussen).
    // Nur Gewerk/Kategorien-Daten und Booleans, keine personenbezogenen Angaben (kein Titel/
    // Beschreibungstext). idempotencyKey verhindert ein doppeltes Event bei einem unwahrscheinlichen
    // erneuten Aufruf mit derselben jobId.
    try {
      await trackEvent({
        event: ANALYTICS_EVENTS.PROJECT_CREATED,
        actorUserId: user.id,
        jobId,
        metadata: {
          gewerk: body.gewerk,
          hasLineItems: !!(body.lineItems && body.lineItems.length > 0),
          hasBudget: !!(body.budgetMin || body.budgetMax),
          hasDeadline: !!body.deadline,
          hasAttachments: !!(body.attachments && body.attachments.length > 0),
        },
        idempotencyKey: `project_created:${jobId}`,
      })
    } catch {
      // trackEvent() wirft bereits nie – dieser catch ist Verteidigung in der Tiefe, konsistent
      // mit dem best-effort-Muster der Matching-/Notification-Pipeline unten.
    }

    // Matching läuft erst NACH dem erfolgreichen Commit, best-effort und vollständig isoliert:
    // ein Matching-Fehler darf einen gültig erstellten Auftrag niemals rückgängig machen oder
    // die Erfolgsantwort verhindern (Phase 3.6A). Einziger Trigger-Punkt im gesamten Code -
    // weder award/offer/PATCH noch ein Dashboard-Aufruf lösen erneut Matching aus.
    try {
      await runMatchingForJob(jobId)
    } catch (matchingError) {
      console.error('Matching für neuen Auftrag fehlgeschlagen:', jobId, matchingError)
      captureError(matchingError, { jobId, operation: 'run_matching_for_job' })
    }

    return NextResponse.json({ ok: true, id: jobId })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht erstellt werden.', req)
  }
}
