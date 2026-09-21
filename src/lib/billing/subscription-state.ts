import type Stripe from 'stripe'
import type { TierId } from '@/lib/tiers'

export type LocalSubscriptionStatus = 'inactive' | 'active' | 'canceled' | 'past_due'

/** Minimaler gemeinsamer Nenner von `Pool` und `PoolClient` – die Ordering-Guard-Updates
 * unten laufen unverändert in beiden Kontexten (einfacher Pool-Query oder Teil einer Transaktion). */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>
}

/**
 * Phase 4.2 (Teil E) – bestehende Zuordnung Stripe-Subscription-Status -> lokaler Status,
 * unverändert aus dem bisherigen Webhook-Code übernommen und nur zentralisiert (vorher inline in
 * customer.subscription.updated dupliziert). KEINE neue fachliche Billing-Policy:
 *
 *   Stripe 'active'                                -> lokal 'active'
 *   Stripe 'past_due'                               -> lokal 'past_due'
 *   Stripe 'trialing' | 'unpaid' | 'incomplete' |
 *   'incomplete_expired' | 'canceled' | 'paused'    -> lokal 'inactive'
 *
 * Diese Buckets waren bereits vor Phase 4.2 so (der alte Code hatte exakt dieselbe
 * Drei-Wege-Fallunterscheidung). Ob z.B. 'trialing' einen eigenen lokalen Status verdienen würde,
 * ist eine Produktentscheidung, die diese Phase nicht trifft (siehe
 * docs/phase-4.2-stripe-hardening.md, "offene Produktentscheidungen").
 *
 * Sonderfall `customer.subscription.deleted`: dieses Event setzt weiterhin explizit den
 * eigenständigen lokalen Status 'canceled' (nicht über diese Funktion, siehe
 * `buildDeletedSubscriptionState` unten) – unverändert gegenüber dem bisherigen Verhalten.
 */
export function mapStripeSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): LocalSubscriptionStatus {
  if (stripeStatus === 'active') return 'active'
  if (stripeStatus === 'past_due') return 'past_due'
  return 'inactive'
}

/**
 * Phase 4.2 (Teil G) – Tier-Bestimmung primär über die Stripe-Price-ID
 * (STRIPE_PRICE_MONTHLY/STRIPE_PRICE_YEARLY, keine hardcodierten IDs), mit Rückfall auf
 * `subscription.metadata.tier` (wie schon vor dieser Phase gesetzt von
 * `checkout/route.ts`/`checkout.session.completed`). Liefert `null`, wenn beides nicht auflösbar
 * ist – der Aufrufer MUSS in diesem Fall den bestehenden lokalen Tier unverändert lassen
 * (`COALESCE`), niemals einen falschen Tarif raten (Audit-Vorgabe Teil G).
 */
export function resolveTierFromSubscription(subscription: Stripe.Subscription): TierId | null {
  const priceId = subscription.items.data[0]?.price?.id
  if (priceId) {
    if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly'
    if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly'
  }
  const metaTier = subscription.metadata?.tier
  if (metaTier === 'monthly' || metaTier === 'yearly') return metaTier
  return null
}

interface OrderingGuardedUpdate {
  userId: string
  /** Stripe Event Creation Time (bzw. `new Date()` bei einer live-abgefragten Reconciliation,
   * siehe reconcile-subscription.ts) – NIE `received_at`/`now()` eines Webhooks, siehe Teil D. */
  eventCreatedAt: Date
}

export interface ApplyCheckoutActivationInput extends OrderingGuardedUpdate {
  tier: TierId
  stripeSubscriptionId: string
  stripeCustomerId: string
  minimumTermMonths: number
}

/**
 * Phase 4.2 (Teil D/I) – wendet die Checkout-Aktivierung nur an, wenn `eventCreatedAt` neuer ist
 * als der zuletzt für diesen Nutzer angewendete Subscription-Zeitpunkt. Atomar über die
 * WHERE-Bedingung im UPDATE selbst (kein Read-then-Write, keine Race Condition). Gibt zurück, ob
 * die Änderung tatsächlich angewendet wurde – `false` bedeutet: das Event war veraltet und wurde
 * bewusst ignoriert, das ist KEIN Fehler.
 */
export async function applyCheckoutActivation(db: Queryable, input: ApplyCheckoutActivationInput): Promise<boolean> {
  const result = await db.query(
    `UPDATE users SET
       subscription_tier = $1,
       subscription_status = 'active',
       stripe_subscription_id = $2,
       stripe_customer_id = $3,
       subscription_committed_until = CASE WHEN $4::int > 0 THEN now() + make_interval(months => $4::int) ELSE NULL END,
       subscription_state_updated_at = $5
     WHERE id = $6 AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < $5)`,
    [input.tier, input.stripeSubscriptionId, input.stripeCustomerId, input.minimumTermMonths, input.eventCreatedAt, input.userId]
  )
  return (result.rowCount ?? 0) > 0
}

export interface ApplySubscriptionUpdatedInput extends OrderingGuardedUpdate {
  status: LocalSubscriptionStatus
  /** `null` = Tier unverändert lassen (COALESCE), siehe resolveTierFromSubscription(). */
  tier: TierId | null
  cancelAt: Date | null
  /** Optional: bei Reconciliation kann die Subscription-ID noch fehlen/abweichen. */
  stripeSubscriptionId?: string | null
}

/** Phase 4.2 (Teil D/G/J) – entspricht der bisherigen `customer.subscription.updated`-Logik, jetzt
 * mit Ordering-Guard, zentralisiertem Status-/Tier-Mapping. Auch von der Reconciliation und von
 * `invoice.payment_failed` (nach `subscriptions.retrieve`) wiederverwendet, statt eine zweite,
 * konkurrierende State-Machine zu bauen (Audit-Vorgabe: "keine zweite State-Machine"). */
export async function applySubscriptionUpdated(db: Queryable, input: ApplySubscriptionUpdatedInput): Promise<boolean> {
  const result = await db.query(
    `UPDATE users SET
       subscription_status = $1,
       subscription_tier = COALESCE($2, subscription_tier),
       subscription_cancel_at = $3,
       stripe_subscription_id = COALESCE($4, stripe_subscription_id),
       subscription_state_updated_at = $5
     WHERE id = $6 AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < $5)`,
    [input.status, input.tier, input.cancelAt, input.stripeSubscriptionId ?? null, input.eventCreatedAt, input.userId]
  )
  return (result.rowCount ?? 0) > 0
}

/** Phase 4.2 (Teil D/H) – entspricht der bisherigen `customer.subscription.deleted`-Logik
 * (lokaler Status 'canceled', cancel_at zurückgesetzt), jetzt mit Ordering-Guard. Mehrfaches
 * `deleted` (gleiches oder älteres Event) ist idempotent: kein Fehler, einfach kein erneutes
 * Schreiben. */
export async function applySubscriptionDeleted(db: Queryable, input: OrderingGuardedUpdate): Promise<boolean> {
  const result = await db.query(
    `UPDATE users SET
       subscription_status = 'canceled',
       subscription_cancel_at = NULL,
       subscription_state_updated_at = $1
     WHERE id = $2 AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < $1)`,
    [input.eventCreatedAt, input.userId]
  )
  return (result.rowCount ?? 0) > 0
}
