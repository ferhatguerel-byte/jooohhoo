import type Stripe from 'stripe'
import { getDb } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { mapStripeSubscriptionStatus, resolveTierFromSubscription, applySubscriptionUpdated } from '@/lib/billing/subscription-state'

export type ReconciliationResult =
  | { status: 'no_customer' }
  | { status: 'no_subscription' }
  | { status: 'reconciled'; stripeStatus: Stripe.Subscription.Status }
  | { status: 'error' }

/**
 * Phase 4.2 (Teil J/L) – kleine, sichere Reconciliation-Funktion: Stripe bleibt Source of Truth,
 * diese Funktion holt den aktuellen Zustand direkt von Stripe und schreibt ihn lokal fest. Keine
 * automatische Massen-Reconciliation (kein Cron in dieser Phase) – aktuell aufgerufen aus dem
 * Checkout-Fallback (`dashboard/abo/page.tsx`, Teil K), vorbereitet für einen späteren
 * Cron/Admin-Trigger. NICHT öffentlich/unauthentifiziert erreichbar: kein eigener API-Endpoint,
 * ausschließlich als serverseitiger Funktionsaufruf aus bereits authentifiziertem Kontext.
 *
 * Bei einem Stripe-API-Fehler wird der lokale Zustand NICHT verändert (Teil T, Test 6) – ein
 * temporärer Stripe-Ausfall darf nie zu einer fälschlichen lokalen Deaktivierung führen.
 */
export async function reconcileUserStripeSubscription(userId: string): Promise<ReconciliationResult> {
  const db = getDb()
  const userResult = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId])
  const customerId: string | null = userResult.rows[0]?.stripe_customer_id ?? null
  if (!customerId) return { status: 'no_customer' }

  const stripe = getStripe()
  let subscriptions: Stripe.Subscription[]
  try {
    const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    subscriptions = list.data
  } catch (err) {
    console.error(
      `[reconcile-subscription] Stripe-Abruf für Customer fehlgeschlagen (userId=${userId}):`,
      err instanceof Error ? err.message : String(err)
    )
    return { status: 'error' }
  }

  if (subscriptions.length === 0) {
    await db.query(
      `UPDATE users SET subscription_status = 'inactive', subscription_cancel_at = NULL, subscription_state_updated_at = now()
       WHERE id = $1 AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < now())`,
      [userId]
    )
    return { status: 'no_subscription' }
  }

  // Diese Architektur sieht pro Nutzer höchstens ein Abo vor (siehe checkout/route.ts: ein
  // Tarifwechsel aktualisiert das bestehende Stripe-Abo, statt ein zweites anzulegen). Existieren
  // trotzdem mehrere (z.B. Altlast oder manuelle Stripe-Dashboard-Aktion), wird deterministisch
  // eine aktive Subscription bevorzugt, sonst die zuletzt erstellte – keine neue Produktentscheidung,
  // nur eine dokumentierte, deterministische Auswahl für einen eigentlich nicht vorgesehenen Zustand
  // (Teil T, Test 5).
  const chosen =
    subscriptions.find((s) => s.status === 'active') ?? subscriptions.slice().sort((a, b) => b.created - a.created)[0]

  const status = mapStripeSubscriptionStatus(chosen.status)
  const tier = resolveTierFromSubscription(chosen)
  const cancelAt = chosen.cancel_at ? new Date(chosen.cancel_at * 1000) : null

  await applySubscriptionUpdated(db, {
    userId,
    status,
    tier,
    cancelAt,
    stripeSubscriptionId: chosen.id,
    // Reconciliation liest live von Stripe – per Definition aktueller als jedes gespeicherte
    // Webhook-Event. new Date() stellt sicher, dass dieser Abgleich nie durch einen älteren, noch
    // ausstehenden Webhook nachträglich überschrieben werden kann (Ordering-Guard, Teil D/L).
    eventCreatedAt: new Date(),
  })

  return { status: 'reconciled', stripeStatus: chosen.status }
}
