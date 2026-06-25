import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const { planId, email, name, ref } = await req.json()

  const plan = PLANS[planId as keyof typeof PLANS]
  if (!plan) return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    customer_email: email,
    metadata: { name, planId, ref: ref || '' },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
    locale: 'de',
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
