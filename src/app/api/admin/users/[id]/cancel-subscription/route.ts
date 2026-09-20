import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
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

    await logAdminAction(admin.id, 'SUBSCRIPTION_CHANGED', 'user', userId, { action: 'admin_canceled' }, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht durchgeführt werden.')
  }
}
