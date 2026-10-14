import { createHash } from 'crypto'
import type Stripe from 'stripe'
import { getDb } from '@/lib/db'
import type { CurrentUser } from '@/lib/current-user'
import { TIERS, type TierId } from '@/lib/tiers'

/** Gültigkeitsdauer einer Tarifwechsel-Preisvorschau. Kurz gewählt, da Stripe die Proration
 * zeitbasiert berechnet (proration_date) – eine sehr lange Gültigkeit könnte einen inzwischen
 * veralteten Betrag zur Ausführung vorlegen. 5 Minuten ist reichlich Zeit für die
 * Nutzerbestätigung, ohne eine spürbar überholte Vorschau zu riskieren. */
export const TIER_CHANGE_PREVIEW_TTL_SECONDS = 300

export interface TierChangePreviewResult {
  id: string
  targetTier: TierId
  amountDueCents: number
  currency: string
  periodEnd: string
  expiresAt: string
}

/**
 * Phase 2B (Aufgabe 3) – berechnet über Stripes `invoices.createPreview` den tatsächlich fälligen
 * Proration-Betrag für einen Tarifwechsel, OHNE ihn auszuführen (reine Vorschau, kein
 * `subscriptions.update`). Das Ergebnis wird serverseitig in `billing_tier_change_previews`
 * gespeichert – der Client erhält nur die `id` zurück, niemals einen Betrag, den er bei der
 * Ausführung selbst vorgeben könnte (siehe claimTierChangePreview() unten, aufgerufen aus
 * src/app/api/billing/checkout/route.ts).
 */
export async function createTierChangePreview(
  stripe: Stripe,
  user: Pick<CurrentUser, 'id' | 'stripeCustomerId' | 'stripeSubscriptionId'>,
  targetTier: TierId
): Promise<TierChangePreviewResult> {
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
    throw new Error('Kein aktives Abo für eine Tarifwechsel-Vorschau vorhanden.')
  }

  const tierDef = TIERS[targetTier]
  const priceId = process.env[tierDef.priceEnv]
  if (!priceId) {
    throw new Error('Zahlungsanbieter ist noch nicht konfiguriert.')
  }

  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
  const currentItemId = subscription.items.data[0]?.id
  if (!currentItemId) {
    throw new Error('Abo konnte nicht gefunden werden.')
  }

  const preview = await stripe.invoices.createPreview({
    customer: user.stripeCustomerId,
    subscription: user.stripeSubscriptionId,
    subscription_details: {
      items: [{ id: currentItemId, price: priceId }],
      proration_behavior: 'create_prorations',
    },
  })

  const expiresAt = new Date(Date.now() + TIER_CHANGE_PREVIEW_TTL_SECONDS * 1000)

  const inserted = await getDb().query<{ id: string }>(
    `INSERT INTO billing_tier_change_previews
       (user_id, stripe_subscription_id, target_tier, amount_due_cents, currency, period_end, expires_at)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
     RETURNING id`,
    [user.id, user.stripeSubscriptionId, targetTier, preview.amount_due, preview.currency, preview.period_end, expiresAt]
  )

  return {
    id: inserted.rows[0]!.id,
    targetTier,
    amountDueCents: preview.amount_due,
    currency: preview.currency,
    periodEnd: new Date(preview.period_end * 1000).toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

export interface ClaimedTierChangePreview {
  id: string
  targetTier: TierId
  stripeSubscriptionId: string
}

/**
 * Atomarer Claim einer Preisvorschau: wird NUR beansprucht, wenn sie demselben Nutzer gehört, zum
 * angeforderten Zieltarif passt, noch nicht abgelaufen UND noch nicht verbraucht ist. Zwei
 * gleichzeitige Bestätigungs-Requests mit derselben previewId (Doppelklick, Netzwerk-Retry)
 * können dadurch nie beide erfolgreich ausführen – derselbe atomare UPDATE-Mechanismus wie beim
 * Match-Notification-Claim (claimNotification() in send-match-notification-emails.ts).
 */
export async function claimTierChangePreview(
  previewId: string,
  userId: string,
  requestedTier: TierId
): Promise<ClaimedTierChangePreview | null> {
  const result = await getDb().query<{ id: string; target_tier: TierId; stripe_subscription_id: string }>(
    `UPDATE billing_tier_change_previews
     SET consumed_at = now()
     WHERE id = $1 AND user_id = $2 AND target_tier = $3
       AND consumed_at IS NULL AND expires_at > now()
     RETURNING id, target_tier, stripe_subscription_id`,
    [previewId, userId, requestedTier]
  )
  const row = result.rows[0]
  if (!row) return null
  return { id: row.id, targetTier: row.target_tier, stripeSubscriptionId: row.stripe_subscription_id }
}

/** Stripe-Idempotency-Key für die tatsächliche Tarifwechsel-Ausführung, deterministisch aus der
 * previewId – ein Netzwerk-Retry derselben Bestätigung (gleiche previewId) dedupliziert sich auch
 * auf Stripe-HTTP-Ebene, zusätzlich zum lokalen atomaren Claim oben (Verteidigung in der Tiefe,
 * analog stripeCustomerCreateIdempotencyKey in checkout/route.ts). */
export function tierChangeIdempotencyKey(previewId: string): string {
  return createHash('sha256').update(`tier-change-confirm:${previewId}`).digest('hex')
}
