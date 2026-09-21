import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { getAppUrl } from '@/lib/url'
import { handleApiError } from '@/lib/api-error'

const checkoutSchema = z.object({ tier: z.enum(TIER_ORDER as [string, ...string[]]) })

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

    let customerId = user.stripeCustomerId

    if (!customerId) {
      // Sicherstellen, dass pro E-Mail-Adresse nur ein Stripe-Kunde/Abo existiert, auch wenn
      // stripe_customer_id lokal aus irgendeinem Grund fehlt.
      const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 })
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.companyName,
          metadata: { userId: user.id },
        })
        customerId = customer.id
      }
      await getDb().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id])
    }

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
