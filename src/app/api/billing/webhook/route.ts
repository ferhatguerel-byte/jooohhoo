import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'

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

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const tier = session.metadata?.tier
      if (userId && tier) {
        await db.query(
          `UPDATE users SET subscription_tier = $1, subscription_status = 'active',
           stripe_subscription_id = $2, stripe_customer_id = $3 WHERE id = $4`,
          [tier, session.subscription, session.customer, userId]
        )
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      const tier = subscription.metadata?.tier
      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : 'inactive'
      if (userId) {
        await db.query(
          'UPDATE users SET subscription_status = $1, subscription_tier = COALESCE($2, subscription_tier) WHERE id = $3',
          [status, tier || null, userId]
        )
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (userId) {
        await db.query("UPDATE users SET subscription_status = 'canceled' WHERE id = $1", [userId])
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
