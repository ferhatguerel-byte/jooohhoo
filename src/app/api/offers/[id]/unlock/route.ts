import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { TIERS } from '@/lib/tiers'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können Kontakte freischalten.' }, { status: 403 })
  }
  if (user.subscriptionStatus !== 'active' || !user.subscriptionTier) {
    return NextResponse.json({ error: 'Aktives Abo erforderlich.' }, { status: 402 })
  }

  const db = getDb()

  const offer = await db.query(
    `SELECT o.id FROM offers o
     JOIN jobs j ON j.id = o.job_id
     WHERE o.id = $1 AND j.auftraggeber_id = $2`,
    [offerId, user.id]
  )
  if (offer.rows.length === 0) {
    return NextResponse.json({ error: 'Angebot nicht gefunden.' }, { status: 404 })
  }

  const alreadyUnlocked = await db.query(
    'SELECT id FROM lead_unlocks WHERE auftraggeber_id = $1 AND offer_id = $2',
    [user.id, offerId]
  )
  if (alreadyUnlocked.rows.length > 0) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true })
  }

  const usedThisMonth = await db.query(
    `SELECT COUNT(*)::int AS count FROM lead_unlocks
     WHERE auftraggeber_id = $1 AND unlocked_at >= date_trunc('month', now())`,
    [user.id]
  )
  const limit = TIERS[user.subscriptionTier].leadsPerMonth
  if (usedThisMonth.rows[0].count >= limit) {
    return NextResponse.json(
      { error: `Sie haben Ihr monatliches Kontingent von ${limit} Kontakten für Ihr ${TIERS[user.subscriptionTier].name}-Abo erreicht.` },
      { status: 402 }
    )
  }

  await db.query('INSERT INTO lead_unlocks (auftraggeber_id, offer_id) VALUES ($1, $2)', [user.id, offerId])

  return NextResponse.json({ ok: true })
}
