import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendNewOfferEmail } from '@/lib/email'

const offerSchema = z.object({
  price: z.number().int().positive().optional(),
  message: z.string().max(2000).optional(),
  pricingType: z.enum(['fixed', 'estimate']).default('estimate'),
  lineItemPrices: z.array(z.object({ lineItemId: z.string().uuid(), price: z.number().int().positive() })).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Nur Subunternehmer können Angebote abgeben.' }, { status: 403 })
  }

  try {
    const body = offerSchema.parse(await req.json())
    const pool = getDb()

    const job = await pool.query(
      `SELECT j.id, j.title, u.email
       FROM jobs j JOIN users u ON u.id = j.auftraggeber_id
       WHERE j.id = $1 AND j.status = 'open'`,
      [jobId]
    )
    if (job.rows.length === 0) {
      return NextResponse.json({ error: 'Auftrag nicht gefunden oder nicht mehr offen.' }, { status: 404 })
    }

    const hasLineItems = body.lineItemPrices && body.lineItemPrices.length > 0
    const totalPrice = hasLineItems
      ? body.lineItemPrices!.reduce((sum, li) => sum + li.price, 0)
      : body.price

    if (!totalPrice) {
      return NextResponse.json({ error: 'Bitte geben Sie einen Preis an.' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const offerResult = await client.query(
        `INSERT INTO offers (job_id, subunternehmer_id, price, message, pricing_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (job_id, subunternehmer_id) DO UPDATE SET price = $3, message = $4, pricing_type = $5
         RETURNING id`,
        [jobId, user.id, totalPrice, body.message || null, body.pricingType]
      )
      const offerId = offerResult.rows[0].id

      if (hasLineItems) {
        await client.query('DELETE FROM offer_line_items WHERE offer_id = $1', [offerId])
        for (const li of body.lineItemPrices!) {
          await client.query(
            `INSERT INTO offer_line_items (offer_id, job_line_item_id, price) VALUES ($1, $2, $3)`,
            [offerId, li.lineItemId, li.price]
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

    try {
      await sendNewOfferEmail(job.rows[0].email, job.rows[0].title, totalPrice, user.companyName)
    } catch (emailErr) {
      console.error('Benachrichtigung fehlgeschlagen:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Angebot abgeben Fehler:', message)
    return NextResponse.json({ error: 'Angebot konnte nicht übermittelt werden.' }, { status: 500 })
  }
}
