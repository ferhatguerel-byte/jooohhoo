import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const admin = await getCurrentUser()
  if (!admin || !process.env.ADMIN_EMAIL || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const db = getDb()
    const target = await db.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId])
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }
    const subscriptionId = target.rows[0].stripe_subscription_id

    if (subscriptionId) {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(subscriptionId)
    }

    await db.query(
      `UPDATE users SET subscription_status = 'canceled', subscription_cancel_at = NULL WHERE id = $1`,
      [userId]
    )

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Admin-Kündigung Fehler:', message)
    return NextResponse.json({ error: 'Kündigung konnte nicht durchgeführt werden.' }, { status: 500 })
  }
}
