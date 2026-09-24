import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser, type CurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { getAppUrl } from '@/lib/url'
import { handleApiError } from '@/lib/api-error'

const checkoutSchema = z.object({ tier: z.enum(TIER_ORDER as [string, ...string[]]) })

/**
 * Deterministischer Stripe-Idempotency-Key für die Customer-Neuanlage eines Users (nie die rohe
 * userId oder E-Mail als Key selbst – gehasht, damit kein internes Datum/PII direkt sichtbar wird,
 * u.a. im Stripe-Dashboard-Log dieses Requests). Zwei praktisch gleichzeitige Checkout-Requests
 * desselben Users (Doppelklick, zwei Tabs, Client-Retry) erzeugen denselben Key -> Stripe
 * dedupliziert den zweiten `customers.create`-Aufruf serverseitig und liefert denselben Customer
 * zurück, statt einen zweiten Live-Customer anzulegen (siehe https://stripe.com/docs/api/idempotent_requests).
 */
export function stripeCustomerCreateIdempotencyKey(userId: string): string {
  return createHash('sha256').update(`checkout-customer-create:${userId}`).digest('hex')
}

/**
 * Ermittelt eine gültige Stripe-Customer-ID für den Checkout. Eine bereits lokal gespeicherte
 * `stripe_customer_id` kann ungültig sein, wenn sie aus einem anderen Stripe-Konto oder -Modus
 * stammt (z. B. Test/Sandbox statt Live) – Stripe lehnt einen Checkout mit einer solchen ID mit
 * "No such customer: cus_..." ab. Deshalb wird eine vorhandene ID vor der Verwendung verifiziert;
 * ist sie ungültig oder gelöscht, greift dieselbe Lookup-per-E-Mail/Erstellung-Logik wie beim
 * erstmaligen Checkout (verhindert doppelte Live-Customer für dieselbe E-Mail-Adresse), und die
 * neue ID wird lokal nachgezogen. Die Neuanlage ist zusätzlich per Stripe-Idempotency-Key gegen
 * echte Nebenläufigkeit abgesichert (siehe stripeCustomerCreateIdempotencyKey).
 */
async function resolveValidCustomerId(stripe: Stripe, user: CurrentUser): Promise<string> {
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId)
      if (!existing.deleted) return user.stripeCustomerId
    } catch (err) {
      // An dieser Stelle wird ausschließlich eine einzelne Customer-ID nachgeschlagen – JEDER
      // StripeInvalidRequestError aus genau diesem Aufruf bedeutet praktisch immer "diese
      // ID-Referenz ist ungültig" (nicht existent, falsches Format, falscher Stripe-Konto/-Modus),
      // unabhängig vom genauen `code` (der bei "No such customer" i.d.R. "resource_missing" ist,
      // aber nicht die einzige denkbare Auslöser-Klassifizierung für eine kaputte ID sein muss).
      // Andere Fehlerklassen (Auth-/Permission-/Rate-Limit-/Netzwerkfehler) sind im Stripe-SDK
      // eigene, von StripeInvalidRequestError NICHT abgeleitete Klassen und werden weiterhin
      // unverändert durchgereicht.
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) {
        throw err
      }
      // Gespeicherte ID existiert in diesem Stripe-Konto/-Modus nicht (mehr) – unten neu auflösen.
    }
  }

  const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 })
  const customerId =
    existingCustomers.data.length > 0
      ? existingCustomers.data[0].id
      : (
          await stripe.customers.create(
            { email: user.email, name: user.companyName, metadata: { userId: user.id } },
            { idempotencyKey: stripeCustomerCreateIdempotencyKey(user.id) }
          )
        ).id

  await getDb().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id])
  return customerId
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Nur Unternehmer können ein Abo abschließen.' }, { status: 403 })
  }

  try {
    const { tier } = checkoutSchema.parse(await req.json())
    const tierDef = TIERS[tier as keyof typeof TIERS]
    const priceId = process.env[tierDef.priceEnv]

    if (!priceId) {
      return NextResponse.json({ error: 'Zahlungsanbieter ist noch nicht konfiguriert.' }, { status: 500 })
    }

    const stripe = getStripe()
    const hasActiveSub = user.subscriptionStatus === 'active' && !!user.subscriptionTier && !!user.stripeSubscriptionId

    if (hasActiveSub) {
      if (user.subscriptionTier === tier) {
        return NextResponse.json({ error: 'Sie haben dieses Abo bereits aktiv.' }, { status: 409 })
      }
      if (user.subscriptionTier === 'yearly' && tier === 'monthly') {
        return NextResponse.json(
          {
            error:
              'Ein Wechsel vom Jahrespaket zum Monatspaket ist während der laufenden 12-Monats-Laufzeit nicht möglich. Bitte kündigen Sie zunächst über "Vertrag kündigen" – nach Ablauf der Laufzeit können Sie dann frei wählen.',
          },
          { status: 409 }
        )
      }

      // Bestehendes Abo (Monatspaket -> Jahrespaket) direkt umstellen, statt ein zweites
      // Stripe-Abo für dieselbe E-Mail-Adresse anzulegen und doppelt abzurechnen.
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!)
      const currentItemId = subscription.items.data[0]?.id
      if (!currentItemId) {
        return NextResponse.json({ error: 'Abo konnte nicht gefunden werden.' }, { status: 404 })
      }

      await stripe.subscriptions.update(user.stripeSubscriptionId!, {
        items: [{ id: currentItemId, price: priceId }],
        metadata: { userId: user.id, tier },
        proration_behavior: 'create_prorations',
      })

      // Phase 4.2: subscription_state_updated_at = now() stempeln (siehe
      // src/lib/billing/subscription-state.ts) – verhindert, dass ein noch ausstehender,
      // älterer Webhook (mit dem vorherigen Tarif in seinem Payload/Metadata) diesen
      // gerade erst vollzogenen Tarifwechsel über den Ordering-Guard rückgängig macht.
      const minimumTermMonths = tierDef.minimumTermMonths
      await getDb().query(
        `UPDATE users SET subscription_tier = $1,
         subscription_committed_until = CASE WHEN $2::int > 0 THEN now() + make_interval(months => $2::int) ELSE NULL END,
         subscription_cancel_at = NULL,
         subscription_state_updated_at = now()
         WHERE id = $3`,
        [tier, minimumTermMonths, user.id]
      )

      const appUrl = getAppUrl(req)
      return NextResponse.json({ url: `${appUrl}/dashboard/abo?success=1` })
    }

    const customerId = await resolveValidCustomerId(stripe, user)

    const appUrl = getAppUrl(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, tier },
      subscription_data: { metadata: { userId: user.id, tier } },
      success_url: `${appUrl}/dashboard/abo?success=1`,
      cancel_url: `${appUrl}/dashboard/abo?canceled=1`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    return handleApiError(err, 'Checkout konnte nicht gestartet werden.')
  }
}
