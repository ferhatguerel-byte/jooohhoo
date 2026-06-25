import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const PLAN_PRICES: Record<string, number> = {
  starter: 2900,
  pro: 7900,
  enterprise: 19900,
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter – €29/Monat',
  pro: 'Pro – €79/Monat',
  enterprise: 'Enterprise – €199/Monat',
}

export async function POST(req: NextRequest) {
  try {
    const { planId, email, name, ref } = await req.json()

    if (!planId || !email || !name) {
      return NextResponse.json({ error: 'Name und E-Mail sind erforderlich.' }, { status: 400 })
    }

    const amount = PLAN_PRICES[planId]
    if (!amount) {
      return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })
    }

    const priceId = process.env[`STRIPE_PRICE_${planId.toUpperCase()}`]

    let lineItems

    if (priceId && !priceId.startsWith('WIRD_') && !priceId.startsWith('price_STARTER')) {
      // Vorhandene Price-ID nutzen
      lineItems = [{ price: priceId, quantity: 1 }]
    } else {
      // Preis direkt inline erstellen (kein Produkt nötig)
      lineItems = [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount,
          recurring: { interval: 'month' as const },
          product_data: {
            name: PLAN_NAMES[planId],
            description: 'AutoBusiness Pro Abonnement – monatlich kündbar',
          },
        },
      }]
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: email,
      metadata: { name, planId, ref: ref || '' },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
      locale: 'de',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Checkout Fehler:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
