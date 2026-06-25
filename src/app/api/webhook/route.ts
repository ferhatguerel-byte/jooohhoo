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
    const affiliateCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const customer = db.createCustomer({
      email,
      name,
      stripeCustomerId: session.customer as string,
      plan: planId || 'starter',
      affiliateCode,
      referredBy: ref || undefined,
    })

    db.createPurchase({
      customerId: customer.id,
      productName: planId || 'starter',
      amount,
      stripeSessionId: session.id,
    })

    db.trackRevenue(new Date().toISOString().split('T')[0], amount, 'subscription')

    await sendWelcomeEmail(email, name || 'Kunde', planId || 'Starter', affiliateCode)
    await sendPaymentConfirmation(email, amount, planId || 'Starter')

    if (ref) {
      const affiliate = db.getCustomerByAffiliateCode(ref)
      if (affiliate) {
        const commissionAmount = Math.round(amount * 0.30 * 100) / 100
        db.createCommission({
          affiliateId: affiliate.id as string,
          referredEmail: email,
          purchaseAmount: amount,
          commissionAmount,
        })
        await sendAffiliateCommissionEmail(affiliate.email as string, commissionAmount, email)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    db.updateCustomerPlan(sub.customer as string, 'free', 'cancelled')
  }

  return NextResponse.json({ received: true })
}
