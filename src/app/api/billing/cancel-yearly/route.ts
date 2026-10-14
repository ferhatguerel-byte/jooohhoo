import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireActiveUserApi } from '@/lib/authorization'
import { getStripe } from '@/lib/stripe'
import { computeCancellationEffectiveDate } from '@/lib/subscription-term'
import { handleApiError } from '@/lib/api-error'
import { enqueueBillingNotification } from '@/lib/billing/billing-notification-outbox'
import { captureError } from '@/lib/observability/sentry'
import { TIERS } from '@/lib/tiers'

/**
 * Bekannte, NICHT in dieser Phase behobene Race Condition (Aufgabe 2.4, ehrlich dokumentiert statt
 * stillschweigend offen gelassen): ruft ein Nutzer nahezu gleichzeitig POST (kündigen) und DELETE
 * (Kündigung zurückziehen) auf, bestimmt allein die Reihenfolge der beiden voneinander
 * unabhängigen Schreibvorgänge (Stripe-Update + lokales UPDATE, je zwei separate Requests) den
 * Endzustand – lokale DB und Stripe könnten dadurch in der sehr seltenen echten Parallelität kurz
 * auseinanderlaufen (z.B. lokal cancel_at gesetzt, bei Stripe bereits wieder null). Wiederholte
 * identische POST-Aufrufe allein sind dagegen unproblematisch: computeCancellationEffectiveDate()
 * ist deterministisch über subscriptionCommittedUntil, zwei POSTs ohne dazwischenliegendes DELETE
 * führen zum selben effectiveDate und damit (über den UNIQUE dedupeKey unten) zu höchstens einer
 * Bestätigungs-E-Mail. Eine vollständige Behebung würde denselben Ordering-Guard benötigen, der
 * bereits für Stripe-Webhooks existiert (subscription_state_updated_at, siehe
 * src/lib/billing/subscription-state.ts) – das ist eine größere, hier bewusst nicht vorgenommene
 * Änderung an der bestehenden Subscription-Zustandsmaschine (Vorgabe: nicht regressiv verändern).
 */
export async function POST() {
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // seine Stripe-Kündigung nicht mehr selbst verwalten (sicherheitsrelevante Kontoänderung).
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }
    if (!user.stripeSubscriptionId || !user.subscriptionCommittedUntil) {
      return NextResponse.json({ error: 'Kein Jahrespaket-Abo mit Mindestlaufzeit gefunden.' }, { status: 404 })
    }

    const requestedAt = new Date()
    const effectiveDate = computeCancellationEffectiveDate(new Date(user.subscriptionCommittedUntil))
    const cancelAtUnix = Math.floor(effectiveDate.getTime() / 1000)

    const stripe = getStripe()
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at: cancelAtUnix })

    await getDb().query('UPDATE users SET subscription_cancel_at = $1 WHERE id = $2', [effectiveDate, user.id])

    // Phase 2B (Aufgabe 2): Kündigungsbestätigung als Outbox-Eintrag – ein fehlgeschlagener
    // E-Mail-Versand darf die bereits wirksame Kündigung (Stripe + lokale DB bereits oben
    // geschrieben) weder rückgängig machen noch dem Nutzer fälschlich als Fehler angezeigt
    // werden. enqueueBillingNotification() wirft laut eigenem Vertrag nie (siehe
    // billing-notification-outbox.ts) – dieses try/catch ist eine zusätzliche, bewusste
    // Absicherung: ohne sie würde ein unerwarteter Fehler hier den äußeren catch erreichen und
    // "Kündigung konnte nicht eingereicht werden." melden, obwohl die Kündigung zu diesem
    // Zeitpunkt bei Stripe und lokal bereits wirksam ist (dieselbe Konsequenz-Begründung wie im
    // Stripe-Webhook, siehe dort). dedupeKey an user+effectiveDate gebunden: ein erneuter POST
    // mit unverändertem Laufzeitende erzeugt nie eine zweite Bestätigung.
    if (user.subscriptionTier) {
      try {
        await enqueueBillingNotification({
          userId: user.id,
          kind: 'cancellation_confirmation',
          dedupeKey: `cancellation_confirmation:${user.id}:${effectiveDate.toISOString()}`,
          payload: {
            tierName: TIERS[user.subscriptionTier].name,
            requestedAt: requestedAt.toISOString(),
            effectiveAt: effectiveDate.toISOString(),
          },
        })
      } catch (err) {
        console.error('Kündigungsbestätigungs-Outbox-Eintrag fehlgeschlagen:', user.id, err)
        captureError(err, { userId: user.id, operation: 'billing_notification_enqueue_after_cancellation' })
      }
    }

    return NextResponse.json({ ok: true, cancelAt: effectiveDate.toISOString() })
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht eingereicht werden.')
  }
}

export async function DELETE() {
  try {
    // requireActiveUserApi(): siehe POST oben.
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }
    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Kein Abo gefunden.' }, { status: 404 })
    }

    const stripe = getStripe()
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at: null })
    await getDb().query('UPDATE users SET subscription_cancel_at = NULL WHERE id = $1', [user.id])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht zurückgezogen werden.')
  }
}
