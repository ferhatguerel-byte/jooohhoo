import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { sendWelcomeEmail, sendPaymentConfirmation, sendAffiliateCommissionEmail } from '@/lib/email'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Ungültige Signatur' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { name, planId, ref } = session.metadata || {}
    const email = session.customer_email || ''
    const amount = (session.amount_total || 0) / 100

    // Zufälligen Affiliate-Code generieren
    const affiliateCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Kunde in DB speichern
    const customer = await db.customer.upsert({
      where: { email },
      create: {
        email,
        name,
        stripeCustomerId: session.customer as string,
        plan: planId || 'starter',
        affiliateCode,
        referredBy: ref || null,
      },
      update: {
        plan: planId || 'starter',
        stripeCustomerId: session.customer as string,
      },
    })

    // Kauf in DB speichern
    await db.purchase.create({
      data: {
        customerId: customer.id,
        productName: planId || 'starter',
        amount,
        stripeSessionId: session.id,
        status: 'completed',
      },
    })

    // Umsatz tracken
    const today = new Date().toISOString().split('T')[0]
    await db.revenue.create({
      data: { date: today, amount, source: 'subscription' },
    })

    // Willkommens-E-Mail senden
    await sendWelcomeEmail(email, name || 'Kunde', planId || 'Starter', affiliateCode)
    await sendPaymentConfirmation(email, amount, planId || 'Starter')

    // Affiliate-Provision verarbeiten (30%)
    if (ref) {
      const affiliate = await db.customer.findFirst({ where: { affiliateCode: ref } })
      if (affiliate) {
        const commissionAmount = Math.round(amount * 0.30 * 100) / 100
        await db.commission.create({
          data: {
            affiliateId: affiliate.id,
            referredEmail: email,
            purchaseAmount: amount,
            commissionAmount,
            status: 'pending',
          },
        })
        await sendAffiliateCommissionEmail(affiliate.email, commissionAmount, email)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await db.customer.updateMany({
      where: { stripeCustomerId: subscription.customer as string },
      data: { plan: 'free', status: 'cancelled' },
    })
  }

  return NextResponse.json({ received: true })
}
