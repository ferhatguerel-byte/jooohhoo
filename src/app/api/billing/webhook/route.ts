import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { TIERS, type TierId } from '@/lib/tiers'
import { claimStripeEvent, markStripeEventProcessed, markStripeEventFailed } from '@/lib/billing/stripe-webhook-events'
import {
  applyCheckoutActivation,
  applySubscriptionUpdated,
  applySubscriptionDeleted,
  mapStripeSubscriptionStatus,
  resolveTierFromSubscription,
} from '@/lib/billing/subscription-state'
import type Stripe from 'stripe'
import { logEvent } from '@/lib/observability/logger'
import { getRequestId, REQUEST_ID_HEADER } from '@/lib/observability/request-id'

/**
 * Phase 4.2 – Stripe-Webhook-Härtung.
 *
 * Ablauf pro Request:
 * 1. Signature-Verifikation (unverändert, Raw Body, siehe Teil M) -> 400 bei ungültiger Signatur.
 * 2. `claimStripeEvent()`: DB-seitig atomarer Idempotenz-Claim über `stripe_webhook_events`
 *    (Teil B/C). Nicht geclaimt (bereits verarbeitet ODER paralleler Request gerade dabei) ->
 *    sofort 200, KEINE erneute Verarbeitung, keine doppelte Nebenwirkung.
 * 3. Fachliche Verarbeitung je nach `event.type`, mit Ordering-Guard (Teil D) über
 *    `subscription_state_updated_at` – ein älteres Event überschreibt nie einen neueren
 *    lokalen Zustand, egal in welcher Reihenfolge die Events eintreffen.
 * 4. Erfolgreich -> `markStripeEventProcessed()`, 200. Fehler -> `markStripeEventFailed()`, 500
 *    (Stripe wiederholt automatisch; ein späterer Reclaim ist über `claimStripeEvent()` möglich).
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook nicht konfiguriert.' }, { status: 500 })
  }

  const stripe = getStripe()
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ungültige Signatur'
    return NextResponse.json({ error: `Webhook-Fehler: ${message}` }, { status: 400 })
  }

  const db = getDb()

  const claim = await claimStripeEvent(db, event.id, event.type, event.created)
  if (!claim.claimed) {
    // Bereits verarbeitet ODER ein paralleler Request verarbeitet dieses Event gerade – in beiden
    // Fällen idempotent erfolgreich beenden, ohne die fachliche Logik erneut auszuführen
    // (Teil C: keine doppelte Subscription-Aktivierung, keine doppelte E-Mail/Analytics-Aktion).
    return NextResponse.json({ received: true, idempotent: true })
  }

  try {
    const eventCreatedAt = new Date(event.created * 1000)

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session, eventCreatedAt)
        break
      }
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(db, event.data.object as Stripe.Subscription, eventCreatedAt)
        break
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription, eventCreatedAt)
        break
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(db, stripe, event.data.object as Stripe.Invoice, eventCreatedAt)
        break
      }
      default:
        break
    }

    await markStripeEventProcessed(db, event.id)
    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    // Bewusst ein Nicht-2xx-Ergebnis zurückgeben: Stripe wiederholt den Webhook dann automatisch.
    // Ein stilles Verschlucken hier würde den Abo-Status dauerhaft inkonsistent lassen.
    //
    // Phase 4.4 (Teil D/G): ein fehlgeschlagenes Stripe-Webhook-Event ist ein UNERWARTETER Fehler
    // (DB-Fehler, Stripe-SDK-Fehler etc.) und wird daher strukturiert geloggt + ans Error-Tracking
    // gemeldet – nie das komplette Event-Payload, nur IDs/Typ/Fehlermeldung (Teil E).
    const message = err instanceof Error ? err.message : String(err)
    const requestId = getRequestId(req)
    logEvent(
      'stripe_webhook_failed',
      'error',
      { requestId, stripeEventId: event.id, eventType: event.type, operation: 'stripe_webhook' },
      err
    )
    await markStripeEventFailed(db, event.id, message)
    const response = NextResponse.json({ error: 'Webhook-Verarbeitung fehlgeschlagen.' }, { status: 500 })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
}

async function handleCheckoutCompleted(
  db: Parameters<typeof applyCheckoutActivation>[0],
  session: Stripe.Checkout.Session,
  eventCreatedAt: Date
) {
  const userId = session.metadata?.userId
  const tier = session.metadata?.tier as TierId | undefined

  // Phase 4.2 (Teil I): keine unbestätigte lokale Aktivierung, wenn Stripe keinen belastbaren
  // aktiven Subscription-Zustand liefert – d.h. es muss tatsächlich eine Subscription entstanden
  // (`session.subscription`) UND die Zahlung bestätigt sein (`payment_status === 'paid'`). Bei
  // asynchronen Zahlungsmethoden (z.B. manche SEPA-Fälle) kann `payment_status` zunächst
  // `unpaid` sein, obwohl die Checkout Session bereits "completed" ist – in diesem Fall aktiviert
  // ein späteres `customer.subscription.updated` die Subscription, sobald Stripe die Zahlung
  // bestätigt hat.
  if (!userId || !tier || !(tier in TIERS) || !session.subscription || session.payment_status !== 'paid') {
    return
  }

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) return

  const minimumTermMonths = TIERS[tier].minimumTermMonths
  await applyCheckoutActivation(db, {
    userId,
    tier,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    minimumTermMonths,
    eventCreatedAt,
  })
}

async function handleSubscriptionUpdated(
  db: Parameters<typeof applySubscriptionUpdated>[0],
  subscription: Stripe.Subscription,
  eventCreatedAt: Date
) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  await applySubscriptionUpdated(db, {
    userId,
    status: mapStripeSubscriptionStatus(subscription.status),
    tier: resolveTierFromSubscription(subscription),
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    eventCreatedAt,
  })
}

async function handleSubscriptionDeleted(
  db: Parameters<typeof applySubscriptionDeleted>[0],
  subscription: Stripe.Subscription,
  eventCreatedAt: Date
) {
  const userId = subscription.metadata?.userId
  if (!userId) return

  await applySubscriptionDeleted(db, { userId, eventCreatedAt })
}

/**
 * Phase 4.2 (Teil F) – `invoice.payment_failed` bedeutet NICHT automatisch "Subscription sofort
 * gelöscht": Stripe unternimmt bei fehlgeschlagenen Zahlungen i.d.R. weitere Zahlungsversuche und
 * setzt die Subscription währenddessen auf `past_due`, nicht sofort auf `canceled`. Deshalb wird
 * die betroffene Subscription aktuell bei Stripe abgerufen (ihr tatsächlicher, autoritativer
 * Status entscheidet) und über dieselbe Logik wie `customer.subscription.updated` angewendet –
 * keine zweite, konkurrierende State-Machine, keine aggressive Kündigung aufgrund eines
 * einzelnen fehlgeschlagenen Zahlungsversuchs.
 */
async function handleInvoicePaymentFailed(
  db: Parameters<typeof applySubscriptionUpdated>[0],
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventCreatedAt: Date
) {
  // Diese Stripe-API-Version (siehe node_modules/stripe package.json) trägt den Subscription-Bezug
  // einer Invoice nicht mehr als Top-Level-Feld `invoice.subscription`, sondern unter
  // `invoice.parent.subscription_details.subscription` (Invoice.Parent.SubscriptionDetails).
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id

  // Keine Subscription auf dieser Invoice (z.B. eine einmalige Rechnung ohne Abo-Bezug) – für die
  // Subscription-State-Machine nicht relevant, kein Fehler.
  if (!subscriptionId) return

  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (err) {
    // Unbekannte/gelöschte Subscription bei Stripe (z.B. sehr alte, längst bereinigte Testdaten) –
    // kein lokaler Nutzer kann daraus sicher aktualisiert werden. Kein Fehler: es gibt nichts
    // Fachliches, das hier noch nachvollzogen werden könnte.
    console.warn(
      `[billing-webhook] invoice.payment_failed: Subscription ${subscriptionId} bei Stripe nicht abrufbar:`,
      err instanceof Error ? err.message : String(err)
    )
    return
  }

  const userId = subscription.metadata?.userId
  if (!userId) return

  await applySubscriptionUpdated(db, {
    userId,
    status: mapStripeSubscriptionStatus(subscription.status),
    tier: resolveTierFromSubscription(subscription),
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    stripeSubscriptionId: subscription.id,
    eventCreatedAt,
  })
}
