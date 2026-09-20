import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE } from '@/lib/gewerke'
import { handleApiError } from '@/lib/api-error'

const lineItemSchema = z.object({
  gewerk: z.enum(GEWERKE),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
})

const attachmentSchema = z.object({ fileId: z.string().uuid(), name: z.string().max(255) })

const jobSchema = z.object({
  title: z.string().min(5),
  gewerk: z.enum(GEWERKE),
  plz: z.string().min(4),
  ort: z.string().min(2),
  description: z.string().min(20),
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
    const body = jobSchema.parse(await req.json())
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

    return NextResponse.json({ ok: true, id: jobId })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht erstellt werden.')
  }
}
