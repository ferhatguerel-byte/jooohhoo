import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein Abo vorhanden.' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard/abo`,
  })

  return NextResponse.json({ url: session.url })
}
