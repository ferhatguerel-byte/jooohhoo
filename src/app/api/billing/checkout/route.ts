import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { TIERS, TIER_ORDER } from '@/lib/tiers'

const checkoutSchema = z.object({ tier: z.enum(TIER_ORDER as [string, ...string[]]) })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können ein Abo abschließen.' }, { status: 403 })
  }

  try {
    const { tier } = checkoutSchema.parse(await req.json())
    const tierDef = TIERS[tier as keyof typeof TIERS]
    const priceId = process.env[tierDef.priceEnv]

    if (!priceId) {
      return NextResponse.json({ error: 'Zahlungsanbieter ist noch nicht konfiguriert.' }, { status: 500 })
    }

    const stripe = getStripe()
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.companyName,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await getDb().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id])
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`

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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Checkout Fehler:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
