import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { computeCancellationEffectiveDate } from '@/lib/subscription-term'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }
  if (!user.stripeSubscriptionId || !user.subscriptionCommittedUntil) {
    return NextResponse.json({ error: 'Kein Jahrespaket-Abo mit Mindestlaufzeit gefunden.' }, { status: 404 })
  }

  try {
    const effectiveDate = computeCancellationEffectiveDate(new Date(user.subscriptionCommittedUntil))
    const cancelAtUnix = Math.floor(effectiveDate.getTime() / 1000)

    const stripe = getStripe()
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at: cancelAtUnix })

    await getDb().query('UPDATE users SET subscription_cancel_at = $1 WHERE id = $2', [effectiveDate, user.id])

    return NextResponse.json({ ok: true, cancelAt: effectiveDate.toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Kündigung Fehler:', message)
    return NextResponse.json({ error: 'Kündigung konnte nicht eingereicht werden.' }, { status: 500 })
  }
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }
  if (!user.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Kein Abo gefunden.' }, { status: 404 })
  }

  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at: null })
    await getDb().query('UPDATE users SET subscription_cancel_at = NULL WHERE id = $1', [user.id])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Kündigung zurückziehen Fehler:', message)
    return NextResponse.json({ error: 'Kündigung konnte nicht zurückgezogen werden.' }, { status: 500 })
  }
}
